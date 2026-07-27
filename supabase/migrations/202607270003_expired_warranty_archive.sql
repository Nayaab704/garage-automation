-- Keep a compact, admin-only proof record before removing an expired-warranty
-- vehicle from the operational tables.
create table if not exists public.vehicle_archive_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null,
  stock_number text,
  vin text,
  year integer,
  make text,
  model text,
  trim text,
  color text,
  mileage numeric,
  sold_date date,
  customer_name text,
  customer_phone text,
  customer_email text,
  sale_price numeric,
  warranty_start_date date,
  warranty_months integer,
  warranty_end_date date,
  total_investment numeric,
  archive_reason text not null default 'expired_warranty',
  archived_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb,
  storage_cleanup_status text not null default 'pending',
  storage_cleanup_failed_count integer not null default 0,
  storage_cleanup_last_attempt_at timestamptz,
  constraint vehicle_archive_records_storage_cleanup_status_check
    check (storage_cleanup_status in ('pending', 'partial', 'complete')),
  constraint vehicle_archive_records_storage_cleanup_failed_count_check
    check (storage_cleanup_failed_count >= 0)
);

alter table public.vehicle_archive_records
  add column if not exists vehicle_id uuid,
  add column if not exists stock_number text,
  add column if not exists vin text,
  add column if not exists year integer,
  add column if not exists make text,
  add column if not exists model text,
  add column if not exists trim text,
  add column if not exists color text,
  add column if not exists mileage numeric,
  add column if not exists sold_date date,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text,
  add column if not exists sale_price numeric,
  add column if not exists warranty_start_date date,
  add column if not exists warranty_months integer,
  add column if not exists warranty_end_date date,
  add column if not exists total_investment numeric,
  add column if not exists archive_reason text default 'expired_warranty',
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists archived_at timestamptz default now(),
  add column if not exists snapshot jsonb default '{}'::jsonb,
  add column if not exists storage_cleanup_status text default 'pending',
  add column if not exists storage_cleanup_failed_count integer default 0,
  add column if not exists storage_cleanup_last_attempt_at timestamptz;

create unique index if not exists vehicle_archive_records_vehicle_id_uidx
  on public.vehicle_archive_records(vehicle_id);

create index if not exists vehicle_archive_records_archived_at_idx
  on public.vehicle_archive_records(archived_at desc);

create index if not exists vehicle_archive_records_warranty_end_date_idx
  on public.vehicle_archive_records(warranty_end_date);

alter table public.vehicle_archive_records enable row level security;

drop policy if exists "archive records can be read by admin manager"
  on public.vehicle_archive_records;
drop policy if exists "archive records can be inserted by admin manager"
  on public.vehicle_archive_records;

create policy "archive records can be read by admin manager"
  on public.vehicle_archive_records
  for select
  to authenticated
  using (public.is_admin_or_manager());

revoke all on table public.vehicle_archive_records from anon;
revoke all on table public.vehicle_archive_records from authenticated;
revoke all on table public.vehicle_archive_records from public;
grant select on table public.vehicle_archive_records to authenticated;

drop function if exists public.archive_expired_warranty_vehicle(uuid);

create or replace function public.archive_expired_warranty_vehicle(
  p_vehicle_id uuid,
  p_expected_warranty_id uuid default null,
  p_expected_warranty_end_date date default null
)
returns table (
  archive_id uuid,
  archived_vehicle_id uuid,
  archived_stock_number text,
  archive_record jsonb,
  photo_paths text[],
  document_paths text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archive public.vehicle_archive_records%rowtype;
  v_archived_by uuid;
  v_business_date date :=
    (clock_timestamp() at time zone 'America/New_York')::date;
  v_customer_email text;
  v_customer_name text;
  v_customer_phone text;
  v_deleted_count integer := 0;
  v_document_paths text[] := '{}'::text[];
  v_photo_paths text[] := '{}'::text[];
  v_prebooking public.vehicle_prebookings%rowtype;
  v_purchase_order_ids uuid[] := '{}'::uuid[];
  v_repair_job_ids uuid[] := '{}'::uuid[];
  v_returned_parts_deduction numeric := 0;
  v_sale public.sales%rowtype;
  v_sale_json jsonb;
  v_third_party_repair_ids uuid[] := '{}'::uuid[];
  v_total_investment numeric;
  v_vehicle public.vehicles%rowtype;
  v_warranty public.warranties%rowtype;
begin
  select profiles.id
    into v_archived_by
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.role in ('owner', 'admin', 'manager')
    and coalesce(profiles.is_active, true) = true
    and profiles.removed_at is null
  order by profiles.created_at desc nulls last
  limit 1;

  if v_archived_by is null or not public.is_admin_or_manager() then
    raise exception 'Only an active admin or manager can archive vehicles.'
      using errcode = '42501';
  end if;

  select *
    into v_vehicle
  from public.vehicles
  where id = p_vehicle_id
  for update;

  if not found then
    -- An interrupted browser can safely retry: return the authoritative
    -- snapshot and its storage manifest without touching database rows again.
    select *
      into v_archive
    from public.vehicle_archive_records
    where vehicle_id = p_vehicle_id;

    if not found then
      raise exception 'Vehicle not found or archived.'
        using errcode = 'P0002';
    end if;

    select coalesce(array_agg(value), '{}'::text[])
      into v_photo_paths
    from jsonb_array_elements_text(
      coalesce(
        v_archive.snapshot #> '{storage_manifest,vehicle_photos}',
        '[]'::jsonb
      )
    ) as manifest(value);

    select coalesce(array_agg(value), '{}'::text[])
      into v_document_paths
    from jsonb_array_elements_text(
      coalesce(
        v_archive.snapshot #> '{storage_manifest,vehicle_documents}',
        '[]'::jsonb
      )
    ) as manifest(value);

    archive_id := v_archive.id;
    archived_vehicle_id := v_archive.vehicle_id;
    archived_stock_number := v_archive.stock_number;
    archive_record := to_jsonb(v_archive);
    photo_paths := v_photo_paths;
    document_paths := v_document_paths;
    return next;
    return;
  end if;

  if exists (
    select 1
    from public.vehicle_archive_records
    where vehicle_id = p_vehicle_id
  ) then
    raise exception 'This vehicle is already archived.'
      using errcode = '23505';
  end if;

  if coalesce(v_vehicle.sale_status, '') <> 'sold' then
    raise exception 'Vehicle is not sold.'
      using errcode = '23514';
  end if;

  -- Lock every sale and warranty row before choosing the current coverage.
  -- This prevents a concurrent extension from racing the archive decision.
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

  if p_expected_warranty_id is null
     or p_expected_warranty_end_date is null
     or v_warranty.id <> p_expected_warranty_id
     or v_warranty.end_date <> p_expected_warranty_end_date then
    raise exception
      'Warranty coverage changed. Refresh and export the current record before archiving.'
      using errcode = '40001';
  end if;

  -- Never remove a vehicle while any sale still has coverage today or later,
  -- even if duplicate historical warranty rows exist.
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

  -- Only return paths whose remaining database references also belong to this
  -- vehicle. Shared objects are deliberately kept.
  select coalesce(array_agg(distinct vehicle_photos.photo_path), '{}'::text[])
    into v_photo_paths
  from public.vehicle_photos
  where (
      vehicle_photos.vehicle_id = p_vehicle_id
      or vehicle_photos.repair_job_id = any(v_repair_job_ids)
    )
    and nullif(btrim(vehicle_photos.photo_path), '') is not null
    and vehicle_photos.photo_path like
      'vehicles/' || p_vehicle_id::text || '/%'
    and not exists (
      select 1
      from public.vehicle_photos as other_photo
      where other_photo.photo_path = vehicle_photos.photo_path
        and not (
          coalesce(other_photo.vehicle_id = p_vehicle_id, false)
          or coalesce(
            other_photo.repair_job_id = any(v_repair_job_ids),
            false
          )
        )
    );

  with candidate_document_paths(path) as (
    select vehicle_documents.file_path
    from public.vehicle_documents
    where (
        vehicle_documents.vehicle_id = p_vehicle_id
        or vehicle_documents.repair_job_id = any(v_repair_job_ids)
        or vehicle_documents.third_party_repair_id =
          any(v_third_party_repair_ids)
        or vehicle_documents.purchase_order_id = any(v_purchase_order_ids)
      )
      and vehicle_documents.file_path like
        'vehicles/' || p_vehicle_id::text || '/documents/%'

    union

    -- Legacy third-party invoices are included only when the stored path uses
    -- this app's known vehicle-documents layout. Unknown/external locations
    -- are deliberately left untouched.
    select third_party_repairs.invoice_path
    from public.third_party_repairs
    where third_party_repairs.id = any(v_third_party_repair_ids)
      and third_party_repairs.invoice_path like
        'vehicles/' || p_vehicle_id::text || '/documents/%'

    union

    select third_party_repairs.invoice_url
    from public.third_party_repairs
    where third_party_repairs.id = any(v_third_party_repair_ids)
      and (
        third_party_repairs.invoice_url like
          '%/storage/v1/object/public/vehicle-documents/vehicles/'
            || p_vehicle_id::text || '/%'
        or third_party_repairs.invoice_url like
          '%/storage/v1/object/sign/vehicle-documents/vehicles/'
            || p_vehicle_id::text || '/%'
        or third_party_repairs.invoice_url like
          '%/storage/v1/object/authenticated/vehicle-documents/vehicles/'
            || p_vehicle_id::text || '/%'
      )

    union

    select vehicle_prebookings.receipt_url
    from public.vehicle_prebookings
    where vehicle_prebookings.vehicle_id = p_vehicle_id
      and (
        vehicle_prebookings.receipt_url like
          '%/storage/v1/object/public/vehicle-documents/vehicles/'
            || p_vehicle_id::text || '/%'
        or vehicle_prebookings.receipt_url like
          '%/storage/v1/object/sign/vehicle-documents/vehicles/'
            || p_vehicle_id::text || '/%'
        or vehicle_prebookings.receipt_url like
          '%/storage/v1/object/authenticated/vehicle-documents/vehicles/'
            || p_vehicle_id::text || '/%'
      )
  )
  select coalesce(array_agg(distinct candidate.path), '{}'::text[])
    into v_document_paths
  from candidate_document_paths as candidate
  where nullif(btrim(candidate.path), '') is not null
    and not exists (
      select 1
      from public.vehicle_documents as other_document
      where (
          other_document.file_path = candidate.path
          or other_document.file_url = candidate.path
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
          other_repair.invoice_path = candidate.path
          or other_repair.invoice_url = candidate.path
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
      where other_prebooking.receipt_url = candidate.path
        and other_prebooking.vehicle_id <> p_vehicle_id
    );

  -- Derive the financial value from the database rather than trusting the
  -- browser's displayed card. The view is optional, so a missing/changed view
  -- leaves the value blank without blocking the archive.
  if to_regclass('public.vehicle_investment_summary') is not null then
    begin
      execute $query$
        select coalesce(
          nullif(to_jsonb(summary) ->> 'total_invested', '')::numeric,
          nullif(to_jsonb(summary) ->> 'total_investment', '')::numeric
        )
        from public.vehicle_investment_summary as summary
        where to_jsonb(summary) ->> 'vehicle_id' = $1::text
           or (
             $2::text is not null
             and to_jsonb(summary) ->> 'stock_number' = $2::text
           )
        limit 1
      $query$
      into v_total_investment
      using p_vehicle_id, v_vehicle.stock_number;
    exception
      when others then
        v_total_investment := null;
    end;
  end if;

  if v_total_investment is not null then
    select coalesce(
      sum(
        coalesce(purchase_order_items.quantity, 1)
          * coalesce(purchase_order_items.unit_cost, 0)
        + coalesce(purchase_order_items.shipping_cost, 0)
        + coalesce(purchase_order_items.tax, 0)
      ),
      0
    )
      into v_returned_parts_deduction
    from public.purchase_order_items
    join public.purchase_orders
      on purchase_orders.id = purchase_order_items.purchase_order_id
    where purchase_orders.vehicle_id = p_vehicle_id
      and (
        purchase_order_items.return_status = 'returned'
        or purchase_order_items.status = 'returned'
      );

    v_total_investment :=
      greatest(v_total_investment - v_returned_parts_deduction, 0);
  end if;

  v_sale_json := to_jsonb(v_sale);
  v_customer_name := nullif(btrim(v_sale.customer_name), '');
  v_customer_phone := nullif(btrim(v_sale.customer_phone), '');
  v_customer_email :=
    nullif(btrim(coalesce(v_sale_json ->> 'customer_email', '')), '');

  if v_customer_email is null
     or v_customer_name is null
     or v_customer_phone is null then
    select *
      into v_prebooking
    from public.vehicle_prebookings
    where vehicle_id = p_vehicle_id
      and status = 'applied_to_sale'
    order by updated_at desc nulls last, created_at desc nulls last
    limit 1;

    if found then
      v_customer_name := coalesce(
        v_customer_name,
        nullif(btrim(v_prebooking.customer_name), '')
      );
      v_customer_phone := coalesce(
        v_customer_phone,
        nullif(btrim(v_prebooking.customer_phone), '')
      );
      v_customer_email := coalesce(
        v_customer_email,
        nullif(btrim(v_prebooking.customer_email), '')
      );
    end if;
  end if;

  insert into public.vehicle_archive_records (
    vehicle_id,
    stock_number,
    vin,
    year,
    make,
    model,
    trim,
    color,
    mileage,
    sold_date,
    customer_name,
    customer_phone,
    customer_email,
    sale_price,
    warranty_start_date,
    warranty_months,
    warranty_end_date,
    total_investment,
    archive_reason,
    archived_by,
    snapshot,
    storage_cleanup_status,
    storage_cleanup_failed_count
  )
  values (
    p_vehicle_id,
    v_vehicle.stock_number,
    v_vehicle.vin,
    v_vehicle.year,
    v_vehicle.make,
    v_vehicle.model,
    v_vehicle.trim,
    v_vehicle.color,
    v_vehicle.mileage,
    v_sale.sale_date,
    v_customer_name,
    v_customer_phone,
    v_customer_email,
    v_sale.sale_price,
    v_warranty.start_date,
    v_warranty.warranty_months,
    v_warranty.end_date,
    v_total_investment,
    'expired_warranty',
    v_archived_by,
    jsonb_build_object(
      'vehicle',
      jsonb_build_object(
        'id', p_vehicle_id,
        'stock_number', v_vehicle.stock_number,
        'vin', v_vehicle.vin,
        'year', v_vehicle.year,
        'make', v_vehicle.make,
        'model', v_vehicle.model,
        'trim', v_vehicle.trim,
        'color', v_vehicle.color,
        'mileage', v_vehicle.mileage
      ),
      'sale',
      jsonb_build_object(
        'id', v_sale.id,
        'sold_date', v_sale.sale_date,
        'customer_name', v_customer_name,
        'customer_phone', v_customer_phone,
        'customer_email', v_customer_email,
        'sale_price', v_sale.sale_price,
        'payment_method', v_sale.payment_method,
        'notes', v_sale.notes
      ),
      'warranty',
      jsonb_build_object(
        'id', v_warranty.id,
        'type', v_warranty.warranty_type,
        'start_date', v_warranty.start_date,
        'months', v_warranty.warranty_months,
        'end_date', v_warranty.end_date,
        'status', 'Expired Warranty',
        'notes', v_warranty.terms
      ),
      'financial',
      jsonb_build_object(
        'sale_price', v_sale.sale_price,
        'total_investment', v_total_investment,
        'returned_parts_deduction', v_returned_parts_deduction
      ),
      'storage_manifest',
      jsonb_build_object(
        'vehicle_photos', to_jsonb(v_photo_paths),
        'vehicle_documents', to_jsonb(v_document_paths)
      )
    ),
    case
      when cardinality(v_photo_paths) + cardinality(v_document_paths) > 0
        then 'pending'
      else 'complete'
    end,
    0
  )
  returning * into v_archive;

  -- Preserve global vendor price memory while detaching live vehicle/workflow
  -- references that are about to be deleted.
  update public.vendor_part_quotes
  set vehicle_id = null,
      repair_job_id = null,
      part_request_id = null,
      purchase_order_id = null,
      purchase_order_item_id = null
  where vehicle_id = p_vehicle_id
     or repair_job_id = any(v_repair_job_ids)
     or part_request_id in (
       select id from public.part_requests where vehicle_id = p_vehicle_id
     )
     or purchase_order_id = any(v_purchase_order_ids)
     or purchase_order_item_id in (
       select purchase_order_items.id
       from public.purchase_order_items
       where purchase_order_id = any(v_purchase_order_ids)
          or part_request_id in (
            select id
            from public.part_requests
            where vehicle_id = p_vehicle_id
               or repair_job_id = any(v_repair_job_ids)
          )
     );

  delete from public.vehicle_documents
  where vehicle_id = p_vehicle_id
     or repair_job_id = any(v_repair_job_ids)
     or third_party_repair_id = any(v_third_party_repair_ids)
     or purchase_order_id = any(v_purchase_order_ids);

  delete from public.purchase_order_items
  where purchase_order_id = any(v_purchase_order_ids)
     or part_request_id in (
       select id
       from public.part_requests
       where vehicle_id = p_vehicle_id
          or repair_job_id = any(v_repair_job_ids)
     );

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
  where vehicle_id = p_vehicle_id
     or repair_job_id = any(v_repair_job_ids);

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
    raise exception 'Vehicle changed before it could be archived.'
      using errcode = '40001';
  end if;

  archive_id := v_archive.id;
  archived_vehicle_id := v_archive.vehicle_id;
  archived_stock_number := v_archive.stock_number;
  archive_record := to_jsonb(v_archive);
  photo_paths := v_photo_paths;
  document_paths := v_document_paths;
  return next;
end;
$$;

create or replace function public.mark_vehicle_archive_storage_cleanup(
  p_archive_id uuid,
  p_failed_count integer
)
returns public.vehicle_archive_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archive public.vehicle_archive_records%rowtype;
  v_failed_count integer := greatest(coalesce(p_failed_count, 0), 0);
begin
  if not public.is_admin_or_manager() then
    raise exception
      'Only an active admin or manager can update archive cleanup status.'
      using errcode = '42501';
  end if;

  update public.vehicle_archive_records
  set storage_cleanup_status = case
        when v_failed_count = 0 then 'complete'
        else 'partial'
      end,
      storage_cleanup_failed_count = v_failed_count,
      storage_cleanup_last_attempt_at = now()
  where id = p_archive_id
  returning * into v_archive;

  if not found then
    raise exception 'Archive record not found.'
      using errcode = 'P0002';
  end if;

  return v_archive;
end;
$$;

revoke all on function public.archive_expired_warranty_vehicle(uuid, uuid, date)
  from public;
grant execute on function public.archive_expired_warranty_vehicle(uuid, uuid, date)
  to authenticated;

revoke all on function public.mark_vehicle_archive_storage_cleanup(uuid, integer)
  from public;
grant execute on function public.mark_vehicle_archive_storage_cleanup(uuid, integer)
  to authenticated;
