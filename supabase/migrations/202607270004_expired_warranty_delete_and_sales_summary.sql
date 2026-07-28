-- Replace the full-record archive workflow with a CSV-first, Storage-first
-- cleanup flow. Existing vehicle_archive_records rows are intentionally kept,
-- but no function in this migration writes to that table.

drop function if exists public.archive_expired_warranty_vehicle(uuid);
drop function if exists public.archive_expired_warranty_vehicle(
  uuid,
  uuid,
  date
);
drop function if exists public.mark_vehicle_archive_storage_cleanup(
  uuid,
  integer
);

-- Keep lifetime sales reporting compact. The per-vehicle marker exists only
-- while the operational vehicle exists; after cleanup, only the monthly count
-- remains.
create table if not exists public.vehicle_sales_monthly_summary (
  month_start date primary key,
  sold_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_sales_monthly_summary_sold_count_check
    check (sold_count >= 0),
  constraint vehicle_sales_monthly_summary_month_start_check
    check (
      month_start = date_trunc('month', month_start::timestamp)::date
    )
);

alter table public.vehicle_sales_monthly_summary
  add column if not exists sold_count integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.vehicles
  add column if not exists first_sale_summary_month date;

comment on column public.vehicles.first_sale_summary_month is
  'Internal first-sale counter guard. Deleted with the operational vehicle.';

alter table public.vehicle_sales_monthly_summary enable row level security;

drop policy if exists "monthly sales summary can be read by admin manager"
  on public.vehicle_sales_monthly_summary;

create policy "monthly sales summary can be read by admin manager"
  on public.vehicle_sales_monthly_summary
  for select
  to authenticated
  using (public.is_admin_or_manager());

revoke all on table public.vehicle_sales_monthly_summary from anon;
revoke all on table public.vehicle_sales_monthly_summary from authenticated;
revoke all on table public.vehicle_sales_monthly_summary from public;
grant select on table public.vehicle_sales_monthly_summary to authenticated;

-- Mark each existing vehicle using its first effective sale date.
with ranked_sales as (
  select
    sales.vehicle_id,
    date_trunc(
      'month',
      coalesce(
        sales.sale_date,
        (sales.created_at at time zone 'America/New_York')::date
      )::timestamp
    )::date as month_start,
    row_number() over (
      partition by sales.vehicle_id
      order by
        coalesce(
          sales.sale_date,
          (sales.created_at at time zone 'America/New_York')::date
        ) asc,
        sales.created_at asc,
        sales.id asc
    ) as sale_rank
  from public.sales
)
update public.vehicles
set first_sale_summary_month = ranked_sales.month_start
from ranked_sales
where ranked_sales.sale_rank = 1
  and vehicles.id = ranked_sales.vehicle_id
  and vehicles.first_sale_summary_month is null;

-- Backfill once from live sales, globally de-duplicated by vehicle before the
-- monthly grouping. GREATEST makes a safe rerun non-decrementing.
with ranked_sales as (
  select
    sales.vehicle_id,
    date_trunc(
      'month',
      coalesce(
        sales.sale_date,
        (sales.created_at at time zone 'America/New_York')::date
      )::timestamp
    )::date as month_start,
    row_number() over (
      partition by sales.vehicle_id
      order by
        coalesce(
          sales.sale_date,
          (sales.created_at at time zone 'America/New_York')::date
        ) asc,
        sales.created_at asc,
        sales.id asc
    ) as sale_rank
  from public.sales
),
first_sales as (
  select vehicle_id, month_start
  from ranked_sales
  where sale_rank = 1
),
monthly_counts as (
  select month_start, count(*)::integer as sold_count
  from first_sales
  group by month_start
)
insert into public.vehicle_sales_monthly_summary (
  month_start,
  sold_count,
  created_at,
  updated_at
)
select
  monthly_counts.month_start,
  monthly_counts.sold_count,
  now(),
  now()
from monthly_counts
on conflict (month_start) do update
set sold_count = greatest(
      vehicle_sales_monthly_summary.sold_count,
      excluded.sold_count
    ),
    updated_at = now();

-- Atomically claim the vehicle's first-sale marker before accepting a sale.
-- This prevents duplicate rows and duplicate monthly increments even when two
-- clients submit the same vehicle concurrently.
create or replace function public.record_first_vehicle_sale_summary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counted_vehicle_id uuid;
  v_existing_summary_month date;
  v_month_start date;
begin
  if new.vehicle_id is null then
    raise exception 'A vehicle is required for a sale.'
      using errcode = '23502';
  end if;

  if exists (
    select 1
    from public.sales
    where sales.vehicle_id = new.vehicle_id
  ) then
    raise exception 'This vehicle already has a sale record.'
      using errcode = '23505';
  end if;

  v_month_start := date_trunc(
    'month',
    coalesce(
      new.sale_date,
      (coalesce(new.created_at, clock_timestamp())
        at time zone 'America/New_York')::date
    )::timestamp
  )::date;

  -- sale_status is also the atomic live-sale claim. The existing delete
  -- trigger returns it to available, so a corrected replacement sale remains
  -- possible without incrementing the lifetime count again.
  update public.vehicles
  set sale_status = 'sold'
  where id = new.vehicle_id
    and sale_status <> 'sold'
  returning id, first_sale_summary_month
    into v_counted_vehicle_id, v_existing_summary_month;

  if v_counted_vehicle_id is null then
    if not exists (
      select 1 from public.vehicles where id = new.vehicle_id
    ) then
      raise exception 'Vehicle not found.'
        using errcode = '23503';
    end if;

    raise exception 'This vehicle already has a sale record.'
      using errcode = '23505';
  end if;

  if v_existing_summary_month is null then
    update public.vehicles
    set first_sale_summary_month = v_month_start
    where id = new.vehicle_id;

    insert into public.vehicle_sales_monthly_summary (
      month_start,
      sold_count,
      created_at,
      updated_at
    )
    values (v_month_start, 1, now(), now())
    on conflict (month_start) do update
    set sold_count = vehicle_sales_monthly_summary.sold_count + 1,
        updated_at = now();
  end if;

  return new;
end;
$$;

create or replace function public.prevent_sale_vehicle_relink()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.vehicle_id is distinct from new.vehicle_id then
    raise exception 'A sale cannot be moved to another vehicle.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Vehicles are broadly editable by active operational users. Keep the
-- internal counter marker immutable to direct client writes; the nested
-- first-sale trigger update is the only normal mutation path.
create or replace function public.protect_first_sale_summary_month()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if pg_trigger_depth() = 1 then
    if tg_op = 'INSERT' and new.first_sale_summary_month is not null then
      raise exception
        'The first-sale summary marker is managed automatically.'
        using errcode = '42501';
    elsif tg_op = 'UPDATE'
       and old.first_sale_summary_month
         is distinct from new.first_sale_summary_month then
      raise exception
        'The first-sale summary marker is managed automatically.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists record_first_vehicle_sale_summary on public.sales;
create trigger record_first_vehicle_sale_summary
before insert on public.sales
for each row
execute function public.record_first_vehicle_sale_summary();

drop trigger if exists prevent_sale_vehicle_relink on public.sales;
create trigger prevent_sale_vehicle_relink
before update of vehicle_id on public.sales
for each row
execute function public.prevent_sale_vehicle_relink();

drop trigger if exists protect_first_sale_summary_month on public.vehicles;
create trigger protect_first_sale_summary_month
before insert or update of first_sale_summary_month on public.vehicles
for each row
execute function public.protect_first_sale_summary_month();

revoke all on function public.record_first_vehicle_sale_summary()
  from public;
revoke all on function public.prevent_sale_vehicle_relink()
  from public;
revoke all on function public.protect_first_sale_summary_month()
  from public;

-- Shared validator used independently by the prepare and delete RPCs. Row
-- locks are held for the duration of the calling RPC transaction.
create or replace function public.validate_expired_warranty_vehicle_delete(
  p_vehicle_id uuid,
  p_expected_sale_id uuid,
  p_expected_warranty_id uuid,
  p_expected_warranty_end_date date
)
returns table (
  validated_sale_id uuid,
  validated_warranty_id uuid,
  validated_warranty_end_date date,
  validated_stock_number text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_date date :=
    (clock_timestamp() at time zone 'America/New_York')::date;
  v_sale public.sales%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_warranty public.warranties%rowtype;
begin
  if not public.is_admin_or_manager() then
    raise exception
      'Only an active admin or manager can delete expired warranty vehicles.'
      using errcode = '42501';
  end if;

  if p_vehicle_id is null
     or p_expected_sale_id is null
     or p_expected_warranty_id is null
     or p_expected_warranty_end_date is null then
    raise exception
      'The sale or warranty record changed. Download a new Archive CSV.'
      using errcode = '40001';
  end if;

  select *
    into v_vehicle
  from public.vehicles
  where id = p_vehicle_id
  for update;

  if not found then
    raise exception 'Vehicle not found or deleted.'
      using errcode = 'P0002';
  end if;

  if coalesce(v_vehicle.sale_status, '') <> 'sold' then
    raise exception 'Vehicle is not sold.'
      using errcode = '23514';
  end if;

  perform sales.id
  from public.sales
  where vehicle_id = p_vehicle_id
  for update;

  perform warranties.id
  from public.warranties
  join public.sales on sales.id = warranties.sale_id
  where sales.vehicle_id = p_vehicle_id
  for update of warranties;

  select *
    into v_sale
  from public.sales
  where vehicle_id = p_vehicle_id
  order by sale_date desc nulls last, created_at desc nulls last, id desc
  limit 1;

  if not found then
    raise exception 'Vehicle is not sold.'
      using errcode = '23514';
  end if;

  if v_sale.id <> p_expected_sale_id then
    raise exception
      'The sale record changed. Download a new Archive CSV before deleting.'
      using errcode = '40001';
  end if;

  select *
    into v_warranty
  from public.warranties as current_warranty
  where current_warranty.sale_id = v_sale.id
  order by
    coalesce(
      nullif(to_jsonb(current_warranty) ->> 'updated_at', '')::timestamptz,
      '-infinity'::timestamptz
    ) desc,
    current_warranty.created_at desc nulls last,
    current_warranty.id desc
  limit 1;

  if not found
     or v_warranty.end_date is null
     or v_warranty.end_date >= v_business_date then
    raise exception
      'Vehicle has no expired warranty with an end date before today.'
      using errcode = '23514';
  end if;

  if v_warranty.id <> p_expected_warranty_id
     or v_warranty.end_date <> p_expected_warranty_end_date then
    raise exception
      'Warranty coverage changed. Download a new Archive CSV before deleting.'
      using errcode = '40001';
  end if;

  if exists (
    select 1
    from public.warranties
    join public.sales on sales.id = warranties.sale_id
    where sales.vehicle_id = p_vehicle_id
      and warranties.end_date >= v_business_date
  ) then
    raise exception 'Vehicle has an active warranty.'
      using errcode = '23514';
  end if;

  validated_sale_id := v_sale.id;
  validated_warranty_id := v_warranty.id;
  validated_warranty_end_date := v_warranty.end_date;
  validated_stock_number := v_vehicle.stock_number;
  return next;
end;
$$;

revoke all on function public.validate_expired_warranty_vehicle_delete(
  uuid,
  uuid,
  uuid,
  date
) from public;

-- Convert a known Supabase Storage URL or bucket-relative value to one
-- canonical object path. External/unknown URLs deliberately return null.
create or replace function public.garage_storage_object_path(
  p_value text,
  p_bucket text
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_marker text;
  v_value text := split_part(btrim(coalesce(p_value, '')), '?', 1);
begin
  if v_value = '' or nullif(btrim(coalesce(p_bucket, '')), '') is null then
    return null;
  end if;

  if v_value !~* '^https?://' then
    return regexp_replace(v_value, '^/+', '');
  end if;

  foreach v_marker in array array[
    '/storage/v1/object/public/' || p_bucket || '/',
    '/storage/v1/object/sign/' || p_bucket || '/',
    '/storage/v1/object/authenticated/' || p_bucket || '/'
  ]
  loop
    if strpos(v_value, v_marker) > 0 then
      return substr(
        v_value,
        strpos(v_value, v_marker) + length(v_marker)
      );
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function public.garage_storage_object_path(text, text)
  from public;

-- Build one deterministic manifest while locking this vehicle's workflow
-- parents and current file rows. The final delete recomputes this manifest so
-- files added after prepare cannot be orphaned by database cleanup.
create or replace function public.collect_expired_vehicle_storage_paths(
  p_vehicle_id uuid
)
returns table (
  collected_photo_paths text[],
  collected_document_paths text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document_paths text[] := '{}'::text[];
  v_photo_paths text[] := '{}'::text[];
  v_purchase_order_ids uuid[] := '{}'::uuid[];
  v_repair_job_ids uuid[] := '{}'::uuid[];
  v_third_party_repair_ids uuid[] := '{}'::uuid[];
begin
  perform repair_jobs.id
  from public.repair_jobs
  where vehicle_id = p_vehicle_id
  for update;

  select coalesce(array_agg(id order by id), '{}'::uuid[])
    into v_repair_job_ids
  from public.repair_jobs
  where vehicle_id = p_vehicle_id;

  perform purchase_orders.id
  from public.purchase_orders
  where vehicle_id = p_vehicle_id
  for update;

  select coalesce(array_agg(id order by id), '{}'::uuid[])
    into v_purchase_order_ids
  from public.purchase_orders
  where vehicle_id = p_vehicle_id;

  perform third_party_repairs.id
  from public.third_party_repairs
  where vehicle_id = p_vehicle_id
     or repair_job_id = any(v_repair_job_ids)
  for update;

  select coalesce(array_agg(id order by id), '{}'::uuid[])
    into v_third_party_repair_ids
  from public.third_party_repairs
  where vehicle_id = p_vehicle_id
     or repair_job_id = any(v_repair_job_ids);

  perform vehicle_photos.id
  from public.vehicle_photos
  where vehicle_id = p_vehicle_id
     or repair_job_id = any(v_repair_job_ids)
  for update;

  with linked_photo_values(value) as (
    select vehicle_photos.photo_path
    from public.vehicle_photos
    where (
        vehicle_photos.vehicle_id = p_vehicle_id
        or vehicle_photos.repair_job_id = any(v_repair_job_ids)
      )

    union all

    select vehicle_photos.photo_url
    from public.vehicle_photos
    where (
        vehicle_photos.vehicle_id = p_vehicle_id
        or vehicle_photos.repair_job_id = any(v_repair_job_ids)
      )
  ),
  candidate_photo_paths(path) as (
    select public.garage_storage_object_path(
      linked_photo_values.value,
      'vehicle-photos'
    )
    from linked_photo_values
  )
  select coalesce(
      array_agg(distinct candidate.path order by candidate.path),
      '{}'::text[]
    )
    into v_photo_paths
  from candidate_photo_paths as candidate
  where candidate.path like 'vehicles/' || p_vehicle_id::text || '/%'
    and not exists (
      select 1
      from public.vehicle_photos as other_photo
      where (
          public.garage_storage_object_path(
            other_photo.photo_path,
            'vehicle-photos'
          ) = candidate.path
          or public.garage_storage_object_path(
            other_photo.photo_url,
            'vehicle-photos'
          ) = candidate.path
        )
        and not (
          coalesce(other_photo.vehicle_id = p_vehicle_id, false)
          or coalesce(
            other_photo.repair_job_id = any(v_repair_job_ids),
            false
          )
        )
    );

  perform vehicle_documents.id
  from public.vehicle_documents
  where vehicle_id = p_vehicle_id
     or repair_job_id = any(v_repair_job_ids)
     or third_party_repair_id = any(v_third_party_repair_ids)
     or purchase_order_id = any(v_purchase_order_ids)
  for update;

  perform vehicle_prebookings.id
  from public.vehicle_prebookings
  where vehicle_id = p_vehicle_id
  for update;

  with linked_document_values(value) as (
    select vehicle_documents.file_path
    from public.vehicle_documents
    where (
        vehicle_documents.vehicle_id = p_vehicle_id
        or vehicle_documents.repair_job_id = any(v_repair_job_ids)
        or vehicle_documents.third_party_repair_id =
          any(v_third_party_repair_ids)
        or vehicle_documents.purchase_order_id = any(v_purchase_order_ids)
      )

    union all

    select vehicle_documents.file_url
    from public.vehicle_documents
    where (
        vehicle_documents.vehicle_id = p_vehicle_id
        or vehicle_documents.repair_job_id = any(v_repair_job_ids)
        or vehicle_documents.third_party_repair_id =
          any(v_third_party_repair_ids)
        or vehicle_documents.purchase_order_id = any(v_purchase_order_ids)
      )

    union all

    select third_party_repairs.invoice_path
    from public.third_party_repairs
    where third_party_repairs.id = any(v_third_party_repair_ids)

    union all

    select third_party_repairs.invoice_url
    from public.third_party_repairs
    where third_party_repairs.id = any(v_third_party_repair_ids)

    union all

    select vehicle_prebookings.receipt_url
    from public.vehicle_prebookings
    where vehicle_prebookings.vehicle_id = p_vehicle_id
  ),
  candidate_document_paths(path) as (
    select public.garage_storage_object_path(
      linked_document_values.value,
      'vehicle-documents'
    )
    from linked_document_values
  )
  select coalesce(
      array_agg(distinct candidate.path order by candidate.path),
      '{}'::text[]
    )
    into v_document_paths
  from candidate_document_paths as candidate
  where candidate.path like
      'vehicles/' || p_vehicle_id::text || '/documents/%'
    and not exists (
      select 1
      from public.vehicle_documents as other_document
      where (
          public.garage_storage_object_path(
            other_document.file_path,
            'vehicle-documents'
          ) = candidate.path
          or public.garage_storage_object_path(
            other_document.file_url,
            'vehicle-documents'
          ) = candidate.path
        )
        and not (
          coalesce(other_document.vehicle_id = p_vehicle_id, false)
          or coalesce(
            other_document.repair_job_id = any(v_repair_job_ids),
            false
          )
          or coalesce(
            other_document.third_party_repair_id =
              any(v_third_party_repair_ids),
            false
          )
          or coalesce(
            other_document.purchase_order_id = any(v_purchase_order_ids),
            false
          )
        )
    )
    and not exists (
      select 1
      from public.third_party_repairs as other_repair
      where (
          public.garage_storage_object_path(
            other_repair.invoice_path,
            'vehicle-documents'
          ) = candidate.path
          or public.garage_storage_object_path(
            other_repair.invoice_url,
            'vehicle-documents'
          ) = candidate.path
        )
        and not (
          coalesce(other_repair.vehicle_id = p_vehicle_id, false)
          or coalesce(
            other_repair.repair_job_id = any(v_repair_job_ids),
            false
          )
        )
    )
    and not exists (
      select 1
      from public.vehicle_prebookings as other_prebooking
      where public.garage_storage_object_path(
          other_prebooking.receipt_url,
          'vehicle-documents'
        ) = candidate.path
        and other_prebooking.vehicle_id <> p_vehicle_id
    );

  collected_photo_paths := v_photo_paths;
  collected_document_paths := v_document_paths;
  return next;
end;
$$;

revoke all on function public.collect_expired_vehicle_storage_paths(uuid)
  from public;

-- Prepare returns a conservative Storage manifest without changing database
-- rows. Only paths in this vehicle's known bucket folders are eligible.
create or replace function public.prepare_expired_warranty_vehicle_delete(
  p_vehicle_id uuid,
  p_expected_sale_id uuid,
  p_expected_warranty_id uuid,
  p_expected_warranty_end_date date
)
returns table (
  prepared_vehicle_id uuid,
  prepared_stock_number text,
  current_sale_id uuid,
  current_warranty_id uuid,
  current_warranty_end_date date,
  photo_paths text[],
  document_paths text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document_paths text[] := '{}'::text[];
  v_photo_paths text[] := '{}'::text[];
  v_sale_id uuid;
  v_stock_number text;
  v_warranty_end_date date;
  v_warranty_id uuid;
begin
  select
    validation.validated_sale_id,
    validation.validated_warranty_id,
    validation.validated_warranty_end_date,
    validation.validated_stock_number
  into
    v_sale_id,
    v_warranty_id,
    v_warranty_end_date,
    v_stock_number
  from public.validate_expired_warranty_vehicle_delete(
    p_vehicle_id,
    p_expected_sale_id,
    p_expected_warranty_id,
    p_expected_warranty_end_date
  ) as validation;

  if v_sale_id is null then
    raise exception 'Vehicle could not be prepared for deletion.'
      using errcode = '40001';
  end if;

  select
    manifest.collected_photo_paths,
    manifest.collected_document_paths
  into v_photo_paths, v_document_paths
  from public.collect_expired_vehicle_storage_paths(
    p_vehicle_id
  ) as manifest;

  prepared_vehicle_id := p_vehicle_id;
  prepared_stock_number := v_stock_number;
  current_sale_id := v_sale_id;
  current_warranty_id := v_warranty_id;
  current_warranty_end_date := v_warranty_end_date;
  photo_paths := v_photo_paths;
  document_paths := v_document_paths;
  return next;
end;
$$;

-- The browser calls this only after every returned Storage path was removed.
-- Eligibility is revalidated here so an extended/changed warranty is never
-- deleted using a stale export.
drop function if exists public.delete_expired_warranty_vehicle(
  uuid,
  uuid,
  uuid,
  date
);

create or replace function public.delete_expired_warranty_vehicle(
  p_vehicle_id uuid,
  p_expected_sale_id uuid,
  p_expected_warranty_id uuid,
  p_expected_warranty_end_date date,
  p_expected_photo_paths text[],
  p_expected_document_paths text[]
)
returns table (
  deleted_vehicle_id uuid,
  deleted_stock_number text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_document_paths text[] := '{}'::text[];
  v_current_photo_paths text[] := '{}'::text[];
  v_deleted_count integer := 0;
  v_part_request_ids uuid[] := '{}'::uuid[];
  v_purchase_order_ids uuid[] := '{}'::uuid[];
  v_purchase_order_item_ids uuid[] := '{}'::uuid[];
  v_repair_job_ids uuid[] := '{}'::uuid[];
  v_sale_id uuid;
  v_stock_number text;
  v_third_party_repair_ids uuid[] := '{}'::uuid[];
begin
  select
    validation.validated_sale_id,
    validation.validated_stock_number
  into v_sale_id, v_stock_number
  from public.validate_expired_warranty_vehicle_delete(
    p_vehicle_id,
    p_expected_sale_id,
    p_expected_warranty_id,
    p_expected_warranty_end_date
  ) as validation;

  if v_sale_id is null then
    raise exception 'Vehicle could not be validated for deletion.'
      using errcode = '40001';
  end if;

  select
    manifest.collected_photo_paths,
    manifest.collected_document_paths
  into v_current_photo_paths, v_current_document_paths
  from public.collect_expired_vehicle_storage_paths(
    p_vehicle_id
  ) as manifest;

  if v_current_photo_paths is distinct from
       coalesce(p_expected_photo_paths, '{}'::text[])
     or v_current_document_paths is distinct from
       coalesce(p_expected_document_paths, '{}'::text[]) then
    raise exception
      'Vehicle files changed. Refresh and download a new Archive CSV.'
      using errcode = '40001';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
    into v_repair_job_ids
  from public.repair_jobs
  where vehicle_id = p_vehicle_id;

  select coalesce(array_agg(id), '{}'::uuid[])
    into v_purchase_order_ids
  from public.purchase_orders
  where vehicle_id = p_vehicle_id;

  select coalesce(array_agg(id), '{}'::uuid[])
    into v_third_party_repair_ids
  from public.third_party_repairs
  where vehicle_id = p_vehicle_id
     or repair_job_id = any(v_repair_job_ids);

  select coalesce(array_agg(id), '{}'::uuid[])
    into v_part_request_ids
  from public.part_requests
  where vehicle_id = p_vehicle_id
     or repair_job_id = any(v_repair_job_ids);

  select coalesce(array_agg(id), '{}'::uuid[])
    into v_purchase_order_item_ids
  from public.purchase_order_items
  where purchase_order_id = any(v_purchase_order_ids)
     or part_request_id = any(v_part_request_ids);

  -- Preserve shared vendor price memory while removing only links to this
  -- vehicle's operational workflow.
  update public.vendor_part_quotes
  set vehicle_id = case
        when vehicle_id = p_vehicle_id then null
        else vehicle_id
      end,
      repair_job_id = case
        when repair_job_id = any(v_repair_job_ids) then null
        else repair_job_id
      end,
      part_request_id = case
        when part_request_id = any(v_part_request_ids) then null
        else part_request_id
      end,
      purchase_order_id = case
        when purchase_order_id = any(v_purchase_order_ids) then null
        else purchase_order_id
      end,
      purchase_order_item_id = case
        when purchase_order_item_id = any(v_purchase_order_item_ids) then null
        else purchase_order_item_id
      end
  where vehicle_id = p_vehicle_id
     or repair_job_id = any(v_repair_job_ids)
     or part_request_id = any(v_part_request_ids)
     or purchase_order_id = any(v_purchase_order_ids)
     or purchase_order_item_id = any(v_purchase_order_item_ids);

  delete from public.vehicle_documents
  where vehicle_id = p_vehicle_id
     or repair_job_id = any(v_repair_job_ids)
     or third_party_repair_id = any(v_third_party_repair_ids)
     or purchase_order_id = any(v_purchase_order_ids);

  delete from public.purchase_order_items
  where id = any(v_purchase_order_item_ids);

  delete from public.warranties
  where sale_id in (
    select id from public.sales where vehicle_id = p_vehicle_id
  );

  delete from public.vehicle_photos
  where vehicle_id = p_vehicle_id
     or repair_job_id = any(v_repair_job_ids);

  delete from public.labor_logs
  where vehicle_id = p_vehicle_id
     or repair_job_id = any(v_repair_job_ids);

  delete from public.cost_entries
  where vehicle_id = p_vehicle_id;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'extra_costs'
      and column_name = 'vehicle_id'
  ) then
    execute 'delete from public.extra_costs where vehicle_id = $1'
      using p_vehicle_id;
  end if;

  delete from public.vehicle_final_checks
  where vehicle_id = p_vehicle_id;

  delete from public.activity_logs
  where vehicle_id = p_vehicle_id;

  delete from public.third_party_repairs
  where vehicle_id = p_vehicle_id
     or repair_job_id = any(v_repair_job_ids);

  delete from public.purchase_orders
  where vehicle_id = p_vehicle_id;

  delete from public.part_requests
  where id = any(v_part_request_ids);

  delete from public.repair_process_items
  where vehicle_id = p_vehicle_id
     or repair_process_id in (
       select id
       from public.repair_processes
       where vehicle_id = p_vehicle_id
     );

  delete from public.repair_processes
  where vehicle_id = p_vehicle_id;

  delete from public.vehicle_prebookings
  where vehicle_id = p_vehicle_id;

  delete from public.sales
  where vehicle_id = p_vehicle_id;

  delete from public.repair_jobs
  where vehicle_id = p_vehicle_id;

  delete from public.vehicles
  where id = p_vehicle_id;

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count <> 1 then
    raise exception 'Vehicle changed before it could be deleted.'
      using errcode = '40001';
  end if;

  deleted_vehicle_id := p_vehicle_id;
  deleted_stock_number := v_stock_number;
  return next;
end;
$$;

revoke all on function public.prepare_expired_warranty_vehicle_delete(
  uuid,
  uuid,
  uuid,
  date
) from public;
revoke all on function public.delete_expired_warranty_vehicle(
  uuid,
  uuid,
  uuid,
  date,
  text[],
  text[]
) from public;

grant execute on function public.prepare_expired_warranty_vehicle_delete(
  uuid,
  uuid,
  uuid,
  date
) to authenticated;
grant execute on function public.delete_expired_warranty_vehicle(
  uuid,
  uuid,
  uuid,
  date,
  text[],
  text[]
) to authenticated;
