-- Vendor Price Memory keeps historical vendor quotes and purchases searchable
-- even after a demo/test vehicle is deleted. Snapshot fields preserve useful
-- context while foreign keys can be nulled safely during cleanup.
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

create or replace function public.normalize_part_name(p_input text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(p_input, '')), '(&|\+|/|\\|-|_)', ' ', 'g'),
        '[^a-z0-9 ]+',
        '',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

create table if not exists public.vendor_part_quotes (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid null references public.vendors(id) on delete set null,
  vendor_name_snapshot text null,
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  repair_job_id uuid null references public.repair_jobs(id) on delete set null,
  part_request_id uuid null references public.part_requests(id) on delete set null,
  purchase_order_id uuid null references public.purchase_orders(id) on delete set null,
  purchase_order_item_id uuid null references public.purchase_order_items(id) on delete set null,
  raw_part_name text not null,
  normalized_part_name text not null,
  part_category text null,
  stock_number_snapshot text null,
  vehicle_year_snapshot integer null,
  vehicle_make_snapshot text null,
  vehicle_model_snapshot text null,
  vehicle_trim_snapshot text null,
  quantity numeric null default 1,
  unit_price numeric not null default 0,
  shipping_cost numeric null default 0,
  tax_cost numeric null default 0,
  total_price numeric generated always as (
    (coalesce(quantity, 1) * unit_price) + coalesce(shipping_cost, 0) + coalesce(tax_cost, 0)
  ) stored,
  quote_status text not null default 'quoted',
  availability text null default 'unknown',
  notes text null,
  quoted_at timestamptz null default now(),
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_part_quotes_raw_part_name_not_blank
    check (length(trim(raw_part_name)) > 0),
  constraint vendor_part_quotes_normalized_part_name_not_blank
    check (length(trim(normalized_part_name)) > 0),
  constraint vendor_part_quotes_quantity_positive
    check (quantity is null or quantity > 0),
  constraint vendor_part_quotes_unit_price_non_negative
    check (unit_price >= 0),
  constraint vendor_part_quotes_shipping_cost_non_negative
    check (shipping_cost is null or shipping_cost >= 0),
  constraint vendor_part_quotes_tax_cost_non_negative
    check (tax_cost is null or tax_cost >= 0),
  constraint vendor_part_quotes_quote_status_valid
    check (quote_status in ('quoted', 'purchased', 'rejected', 'unavailable')),
  constraint vendor_part_quotes_availability_valid
    check (availability is null or availability in ('in_stock', 'order_needed', 'unavailable', 'unknown'))
);

comment on table public.vendor_part_quotes is
  'Vendor quote and purchase price memory for parts. History survives vehicle deletion through snapshots and nullable references.';
comment on column public.vendor_part_quotes.raw_part_name is
  'Original user-facing part name from the quote or purchase.';
comment on column public.vendor_part_quotes.normalized_part_name is
  'Search-friendly normalized part name used for matching previous prices.';
comment on column public.vendor_part_quotes.vendor_name_snapshot is
  'Vendor name at quote/purchase time so history stays readable if the vendor record changes or is removed.';
comment on column public.vendor_part_quotes.stock_number_snapshot is
  'Vehicle stock number at quote/purchase time so history stays useful after vehicle deletion.';

create or replace function public.set_vendor_part_quotes_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_vendor_part_quotes_updated_at on public.vendor_part_quotes;
create trigger set_vendor_part_quotes_updated_at
before update on public.vendor_part_quotes
for each row
execute function public.set_vendor_part_quotes_updated_at();

create or replace function public.set_vendor_part_quotes_normalized_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.raw_part_name := nullif(trim(new.raw_part_name), '');
  new.normalized_part_name := public.normalize_part_name(
    coalesce(nullif(new.normalized_part_name, ''), new.raw_part_name)
  );

  if new.raw_part_name is null or length(new.normalized_part_name) = 0 then
    raise exception 'Part name is required.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists set_vendor_part_quotes_normalized_name on public.vendor_part_quotes;
create trigger set_vendor_part_quotes_normalized_name
before insert or update of raw_part_name, normalized_part_name
on public.vendor_part_quotes
for each row
execute function public.set_vendor_part_quotes_normalized_name();

create index if not exists vendor_part_quotes_vendor_id_idx
  on public.vendor_part_quotes (vendor_id);

create index if not exists vendor_part_quotes_normalized_part_name_idx
  on public.vendor_part_quotes (normalized_part_name);

create index if not exists vendor_part_quotes_normalized_part_name_trgm_idx
  on public.vendor_part_quotes
  using gin (normalized_part_name gin_trgm_ops);

create index if not exists vendor_part_quotes_quote_status_idx
  on public.vendor_part_quotes (quote_status);

create index if not exists vendor_part_quotes_quoted_at_desc_idx
  on public.vendor_part_quotes (quoted_at desc);

create index if not exists vendor_part_quotes_vehicle_snapshot_idx
  on public.vendor_part_quotes (
    lower(coalesce(vehicle_make_snapshot, '')),
    lower(coalesce(vehicle_model_snapshot, '')),
    vehicle_year_snapshot
  );

create or replace function public.search_vendor_part_quotes(
  p_part_name text,
  p_vehicle_make text default null,
  p_vehicle_model text default null,
  p_vehicle_year integer default null,
  p_limit integer default 8
)
returns table (
  id uuid,
  raw_part_name text,
  normalized_part_name text,
  vendor_id uuid,
  vendor_name text,
  unit_price numeric,
  quantity numeric,
  shipping_cost numeric,
  tax_cost numeric,
  total_price numeric,
  quote_status text,
  availability text,
  quoted_at timestamptz,
  stock_number_snapshot text,
  vehicle_year_snapshot integer,
  vehicle_make_snapshot text,
  vehicle_model_snapshot text,
  vehicle_trim_snapshot text,
  notes text,
  relevance_score numeric
)
language sql
stable
set search_path = public
as $$
  with search_input as (
    select
      public.normalize_part_name(p_part_name) as normalized_query,
      lower(nullif(trim(p_vehicle_make), '')) as vehicle_make,
      lower(nullif(trim(p_vehicle_model), '')) as vehicle_model,
      greatest(1, least(coalesce(p_limit, 8), 25)) as result_limit
  ),
  tokens as (
    select token
    from search_input,
      regexp_split_to_table(search_input.normalized_query, '\s+') as token
    where length(token) >= 2
  ),
  scored_quotes as (
    select
      quote.id,
      quote.raw_part_name,
      quote.normalized_part_name,
      quote.vendor_id,
      coalesce(quote.vendor_name_snapshot, vendor.name) as vendor_name,
      quote.unit_price,
      quote.quantity,
      quote.shipping_cost,
      quote.tax_cost,
      quote.total_price,
      quote.quote_status,
      quote.availability,
      quote.quoted_at,
      quote.stock_number_snapshot,
      quote.vehicle_year_snapshot,
      quote.vehicle_make_snapshot,
      quote.vehicle_model_snapshot,
      quote.vehicle_trim_snapshot,
      quote.notes,
      (
        case
          when quote.normalized_part_name = search_input.normalized_query then 100
          when quote.normalized_part_name % search_input.normalized_query then 70 * similarity(quote.normalized_part_name, search_input.normalized_query)
          when quote.normalized_part_name ilike '%' || search_input.normalized_query || '%' then 55
          when exists (
            select 1
            from tokens
            where quote.normalized_part_name ilike '%' || tokens.token || '%'
          ) then 35
          else 0
        end
        + case when quote.quote_status = 'purchased' then 8 else 0 end
        + case when search_input.vehicle_make is not null and lower(coalesce(quote.vehicle_make_snapshot, '')) = search_input.vehicle_make then 8 else 0 end
        + case when search_input.vehicle_model is not null and lower(coalesce(quote.vehicle_model_snapshot, '')) = search_input.vehicle_model then 8 else 0 end
        + case when p_vehicle_year is not null and quote.vehicle_year_snapshot = p_vehicle_year then 4 else 0 end
        + case
            when quote.quoted_at is null then 0
            when quote.quoted_at >= now() - interval '90 days' then 6
            when quote.quoted_at >= now() - interval '1 year' then 3
            else 0
          end
      )::numeric as relevance_score
    from public.vendor_part_quotes quote
    cross join search_input
    left join public.vendors vendor on vendor.id = quote.vendor_id
    where length(search_input.normalized_query) > 0
      and (
        quote.normalized_part_name = search_input.normalized_query
        or quote.normalized_part_name % search_input.normalized_query
        or quote.normalized_part_name ilike '%' || search_input.normalized_query || '%'
        or exists (
          select 1
          from tokens
          where quote.normalized_part_name ilike '%' || tokens.token || '%'
        )
      )
  )
  select
    scored_quotes.id,
    scored_quotes.raw_part_name,
    scored_quotes.normalized_part_name,
    scored_quotes.vendor_id,
    scored_quotes.vendor_name,
    scored_quotes.unit_price,
    scored_quotes.quantity,
    scored_quotes.shipping_cost,
    scored_quotes.tax_cost,
    scored_quotes.total_price,
    scored_quotes.quote_status,
    scored_quotes.availability,
    scored_quotes.quoted_at,
    scored_quotes.stock_number_snapshot,
    scored_quotes.vehicle_year_snapshot,
    scored_quotes.vehicle_make_snapshot,
    scored_quotes.vehicle_model_snapshot,
    scored_quotes.vehicle_trim_snapshot,
    scored_quotes.notes,
    scored_quotes.relevance_score
  from scored_quotes, search_input
  where scored_quotes.relevance_score > 0
  order by
    scored_quotes.relevance_score desc,
    scored_quotes.unit_price asc,
    scored_quotes.quoted_at desc nulls last
  limit (select result_limit from search_input);
$$;

revoke all on function public.search_vendor_part_quotes(text, text, text, integer, integer) from public;
grant execute on function public.search_vendor_part_quotes(text, text, text, integer, integer) to authenticated;

-- Keep price history when a vehicle is permanently deleted: clear live
-- references first, then let snapshots preserve vendor/vehicle context.
create or replace function public.delete_vehicle_cascade(p_vehicle_id uuid)
returns table (
  deleted_vehicle_id uuid,
  deleted_stock_number text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock_number text;
begin
  if not exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid()
      and role in ('owner', 'admin')
      and coalesce(is_active, true) = true
  ) then
    raise exception 'Only admin/manager can delete vehicles.'
      using errcode = '42501';
  end if;

  select stock_number
    into v_stock_number
  from public.vehicles
  where id = p_vehicle_id;

  if not found then
    raise exception 'Vehicle not found.'
      using errcode = 'P0002';
  end if;

  update public.vendor_part_quotes
  set vehicle_id = null,
      repair_job_id = null,
      part_request_id = null,
      purchase_order_id = null,
      purchase_order_item_id = null
  where vehicle_id = p_vehicle_id
     or repair_job_id in (
       select id from public.repair_jobs where vehicle_id = p_vehicle_id
     )
     or part_request_id in (
       select id from public.part_requests where vehicle_id = p_vehicle_id
     )
     or purchase_order_id in (
       select id from public.purchase_orders where vehicle_id = p_vehicle_id
     )
     or purchase_order_item_id in (
       select purchase_order_items.id
       from public.purchase_order_items
       where purchase_order_id in (
         select id from public.purchase_orders where vehicle_id = p_vehicle_id
       )
          or part_request_id in (
            select id from public.part_requests where vehicle_id = p_vehicle_id
          )
     );

  delete from public.vehicle_documents
  where vehicle_id = p_vehicle_id
     or repair_job_id in (
       select id from public.repair_jobs where vehicle_id = p_vehicle_id
     )
     or third_party_repair_id in (
       select id
       from public.third_party_repairs
       where vehicle_id = p_vehicle_id
          or repair_job_id in (
            select id from public.repair_jobs where vehicle_id = p_vehicle_id
          )
     )
     or purchase_order_id in (
       select id from public.purchase_orders where vehicle_id = p_vehicle_id
     );

  delete from public.purchase_order_items
  where purchase_order_id in (
      select id from public.purchase_orders where vehicle_id = p_vehicle_id
    )
     or part_request_id in (
      select id from public.part_requests where vehicle_id = p_vehicle_id
    )
     or part_request_id in (
      select part_requests.id
      from public.part_requests
      join public.repair_jobs on repair_jobs.id = part_requests.repair_job_id
      where repair_jobs.vehicle_id = p_vehicle_id
    );

  delete from public.warranties
  where sale_id in (
    select id from public.sales where vehicle_id = p_vehicle_id
  );

  delete from public.vehicle_photos
  where vehicle_id = p_vehicle_id
     or repair_job_id in (
       select id from public.repair_jobs where vehicle_id = p_vehicle_id
     );

  delete from public.labor_logs
  where vehicle_id = p_vehicle_id
     or repair_job_id in (
       select id from public.repair_jobs where vehicle_id = p_vehicle_id
     );

  delete from public.cost_entries
  where vehicle_id = p_vehicle_id;

  delete from public.vehicle_final_checks
  where vehicle_id = p_vehicle_id;

  delete from public.activity_logs
  where vehicle_id = p_vehicle_id;

  delete from public.third_party_repairs
  where vehicle_id = p_vehicle_id
     or repair_job_id in (
       select id from public.repair_jobs where vehicle_id = p_vehicle_id
     );

  delete from public.purchase_orders
  where vehicle_id = p_vehicle_id;

  delete from public.part_requests
  where vehicle_id = p_vehicle_id
     or repair_job_id in (
       select id from public.repair_jobs where vehicle_id = p_vehicle_id
     );

  delete from public.repair_process_items
  where vehicle_id = p_vehicle_id
     or repair_process_id in (
       select id from public.repair_processes where vehicle_id = p_vehicle_id
     );

  delete from public.repair_processes
  where vehicle_id = p_vehicle_id;

  delete from public.sales
  where vehicle_id = p_vehicle_id;

  delete from public.repair_jobs
  where vehicle_id = p_vehicle_id;

  delete from public.vehicles
  where id = p_vehicle_id;

  deleted_vehicle_id := p_vehicle_id;
  deleted_stock_number := v_stock_number;
  return next;
end;
$$;

revoke all on function public.delete_vehicle_cascade(uuid) from public;
grant execute on function public.delete_vehicle_cascade(uuid) to authenticated;
