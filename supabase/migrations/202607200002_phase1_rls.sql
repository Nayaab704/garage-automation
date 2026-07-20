-- Phase 1 RLS for the garage app.
--
-- Emergency debugging rollback, table by table:
--   alter table public.<table_name> disable row level security;
--
-- Storage Phase 2 note:
--   The app currently uses the vehicle-photos and vehicle-documents buckets.
--   This migration focuses on database RLS only so existing public URL/upload
--   behavior is not changed unexpectedly.

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profiles.id
  from public.profiles
  where profiles.auth_user_id = auth.uid()
  order by profiles.created_at desc nulls last
  limit 1;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(profiles.role, '')
  from public.profiles
  where profiles.auth_user_id = auth.uid()
  order by profiles.created_at desc nulls last
  limit 1;
$$;

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.auth_user_id = auth.uid()
      -- Match the current app behavior: explicit false is blocked, while
      -- legacy null values are treated as active until an admin updates them.
      and coalesce(profiles.is_active, true) = true
      and profiles.removed_at is null
  );
$$;

create or replace function public.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_member()
    and public.current_user_role() in ('owner', 'admin', 'manager');
$$;

create or replace function public.is_technician()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_member()
    and public.current_user_role() = 'technician';
$$;

create or replace function public.update_current_profile_name(p_full_name text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_full_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  updated_profile public.profiles;
begin
  if clean_full_name is null then
    raise exception 'Full name is required.'
      using errcode = '23514';
  end if;

  update public.profiles
     set full_name = clean_full_name
   where auth_user_id = auth.uid()
     and coalesce(is_active, true) = true
     and removed_at is null
   returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Only active team members can update their own profile name.'
      using errcode = '42501';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.current_user_role() from public;
revoke all on function public.is_active_member() from public;
revoke all on function public.is_admin_or_manager() from public;
revoke all on function public.is_technician() from public;
revoke all on function public.update_current_profile_name(text) from public;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.is_admin_or_manager() to authenticated;
grant execute on function public.is_technician() to authenticated;
grant execute on function public.update_current_profile_name(text) to authenticated;

-- Replace older policies that only checked is_active and did not know about
-- removed_at.
do $$
begin
  if to_regclass('public.vehicle_prebookings') is not null then
    execute 'drop policy if exists "vehicle prebookings can be managed by sales roles" on public.vehicle_prebookings';
  end if;

  if to_regclass('public.vehicle_catalog_entries') is not null then
    execute 'drop policy if exists "vehicle catalog entries are readable by active users" on public.vehicle_catalog_entries';
  end if;
end $$;

-- Profiles: admins/managers manage the team. Normal users can read their own
-- profile row for login state; cross-user attribution uses the safe view below
-- so hourly_rate and status-management fields are not exposed broadly.
alter table public.profiles enable row level security;

drop policy if exists "phase1 profiles readable" on public.profiles;
drop policy if exists "phase1 profiles admin insert" on public.profiles;
drop policy if exists "phase1 profiles signup insert" on public.profiles;
drop policy if exists "phase1 profiles admin update" on public.profiles;
drop policy if exists "phase1 profiles self update" on public.profiles;
drop policy if exists "phase1 profiles signup update" on public.profiles;
drop policy if exists "phase1 profiles admin delete" on public.profiles;

create policy "phase1 profiles readable"
  on public.profiles
  for select
  to authenticated
  using (
    public.is_admin_or_manager()
    or auth.uid() = auth_user_id
  );

create policy "phase1 profiles admin insert"
  on public.profiles
  for insert
  to authenticated
  with check (public.is_admin_or_manager());

create policy "phase1 profiles signup insert"
  on public.profiles
  for insert
  to authenticated
  with check (
    auth.uid() = auth_user_id
    and coalesce(is_active, false) = false
    and removed_at is null
    and role = 'technician'
  );

create policy "phase1 profiles admin update"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

create policy "phase1 profiles signup update"
  on public.profiles
  for update
  to authenticated
  using (
    auth.uid() = auth_user_id
    and coalesce(is_active, false) = false
    and removed_at is null
  )
  with check (
    auth.uid() = auth_user_id
    and coalesce(is_active, false) = false
    and removed_at is null
    and role = 'technician'
  );

create policy "phase1 profiles admin delete"
  on public.profiles
  for delete
  to authenticated
  using (public.is_admin_or_manager());

grant select, insert, update, delete on table public.profiles to authenticated;

drop view if exists public.profile_display_names;

create view public.profile_display_names as
select
  id,
  full_name,
  email,
  role
from public.profiles
where public.is_active_member()
  and removed_at is null;

grant select on table public.profile_display_names to authenticated;

-- Vehicles are operational records: all active members can read/create/update
-- as the existing UI permits, while destructive deletes stay admin/manager.
do $$
begin
  if to_regclass('public.vehicles') is not null then
    alter table public.vehicles enable row level security;

    drop policy if exists "phase1 vehicles active read" on public.vehicles;
    drop policy if exists "phase1 vehicles active insert" on public.vehicles;
    drop policy if exists "phase1 vehicles active update" on public.vehicles;
    drop policy if exists "phase1 vehicles admin delete" on public.vehicles;

    create policy "phase1 vehicles active read"
      on public.vehicles
      for select
      to authenticated
      using (public.is_active_member());

    create policy "phase1 vehicles active insert"
      on public.vehicles
      for insert
      to authenticated
      with check (public.is_active_member());

    create policy "phase1 vehicles active update"
      on public.vehicles
      for update
      to authenticated
      using (public.is_active_member())
      with check (public.is_active_member());

    create policy "phase1 vehicles admin delete"
      on public.vehicles
      for delete
      to authenticated
      using (public.is_admin_or_manager());

    grant select, insert, update, delete on table public.vehicles to authenticated;
  end if;
end $$;

-- Operational workflow tables: keep active team access broad enough for the
-- current repairs, parts, POs, photos, documents, and third-party workflows.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'repair_jobs',
    'repair_processes',
    'repair_process_items',
    'part_requests',
    'purchase_orders',
    'purchase_order_items',
    'vehicle_photos',
    'vehicle_documents',
    'third_party_repairs',
    'vehicle_catalog_entries',
    'vehicle_final_checks',
    'vendor_part_quotes'
  ]
  loop
    if exists (
      select 1
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relname = table_name
        and pg_class.relkind in ('r', 'p')
    ) then
      execute format('alter table public.%I enable row level security', table_name);

      execute format('drop policy if exists %I on public.%I', 'phase1 active members can read', table_name);
      execute format('drop policy if exists %I on public.%I', 'phase1 active members can insert', table_name);
      execute format('drop policy if exists %I on public.%I', 'phase1 active members can update', table_name);
      execute format('drop policy if exists %I on public.%I', 'phase1 active members can delete', table_name);

      execute format(
        'create policy %I on public.%I for select to authenticated using (public.is_active_member())',
        'phase1 active members can read',
        table_name
      );
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (public.is_active_member())',
        'phase1 active members can insert',
        table_name
      );
      execute format(
        'create policy %I on public.%I for update to authenticated using (public.is_active_member()) with check (public.is_active_member())',
        'phase1 active members can update',
        table_name
      );
      execute format(
        'create policy %I on public.%I for delete to authenticated using (public.is_active_member())',
        'phase1 active members can delete',
        table_name
      );

      execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    end if;
  end loop;
end $$;

-- Vendors stay visible to the team, but creation/edit/delete remains a team
-- management/admin responsibility.
do $$
begin
  if to_regclass('public.vendors') is not null then
    alter table public.vendors enable row level security;

    drop policy if exists "phase1 vendors active read" on public.vendors;
    drop policy if exists "phase1 vendors admin insert" on public.vendors;
    drop policy if exists "phase1 vendors admin update" on public.vendors;
    drop policy if exists "phase1 vendors admin delete" on public.vendors;

    create policy "phase1 vendors active read"
      on public.vendors
      for select
      to authenticated
      using (public.is_active_member());

    create policy "phase1 vendors admin insert"
      on public.vendors
      for insert
      to authenticated
      with check (public.is_admin_or_manager());

    create policy "phase1 vendors admin update"
      on public.vendors
      for update
      to authenticated
      using (public.is_admin_or_manager())
      with check (public.is_admin_or_manager());

    create policy "phase1 vendors admin delete"
      on public.vendors
      for delete
      to authenticated
      using (public.is_admin_or_manager());

    grant select, insert, update, delete on table public.vendors to authenticated;
  end if;
end $$;

-- Service categories are shared reference data. Active members read; admins
-- manage if the app later exposes category editing.
do $$
begin
  if to_regclass('public.service_categories') is not null then
    alter table public.service_categories enable row level security;

    drop policy if exists "phase1 service categories active read" on public.service_categories;
    drop policy if exists "phase1 service categories admin insert" on public.service_categories;
    drop policy if exists "phase1 service categories admin update" on public.service_categories;
    drop policy if exists "phase1 service categories admin delete" on public.service_categories;

    create policy "phase1 service categories active read"
      on public.service_categories
      for select
      to authenticated
      using (public.is_active_member());

    create policy "phase1 service categories admin insert"
      on public.service_categories
      for insert
      to authenticated
      with check (public.is_admin_or_manager());

    create policy "phase1 service categories admin update"
      on public.service_categories
      for update
      to authenticated
      using (public.is_admin_or_manager())
      with check (public.is_admin_or_manager());

    create policy "phase1 service categories admin delete"
      on public.service_categories
      for delete
      to authenticated
      using (public.is_admin_or_manager());

    grant select, insert, update, delete on table public.service_categories to authenticated;
  end if;
end $$;

-- Activity logs are append-only for regular active users.
do $$
begin
  if to_regclass('public.activity_logs') is not null then
    alter table public.activity_logs enable row level security;

    drop policy if exists "phase1 activity logs active read" on public.activity_logs;
    drop policy if exists "phase1 activity logs active insert" on public.activity_logs;
    drop policy if exists "phase1 activity logs admin update" on public.activity_logs;
    drop policy if exists "phase1 activity logs admin delete" on public.activity_logs;

    create policy "phase1 activity logs active read"
      on public.activity_logs
      for select
      to authenticated
      using (public.is_active_member());

    create policy "phase1 activity logs active insert"
      on public.activity_logs
      for insert
      to authenticated
      with check (public.is_active_member());

    create policy "phase1 activity logs admin update"
      on public.activity_logs
      for update
      to authenticated
      using (public.is_admin_or_manager())
      with check (public.is_admin_or_manager());

    create policy "phase1 activity logs admin delete"
      on public.activity_logs
      for delete
      to authenticated
      using (public.is_admin_or_manager());

    grant select, insert, update, delete on table public.activity_logs to authenticated;
  end if;
end $$;

-- Prebooking details contain customer/deposit/payment data. Sales roles can
-- manage full rows; technicians use the safe badge view below.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'vehicle_prebookings',
    'sales',
    'warranties'
  ]
  loop
    if exists (
      select 1
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relname = table_name
        and pg_class.relkind in ('r', 'p')
    ) then
      execute format('alter table public.%I enable row level security', table_name);

      execute format('drop policy if exists %I on public.%I', 'phase1 sales roles can read', table_name);
      execute format('drop policy if exists %I on public.%I', 'phase1 sales roles can insert', table_name);
      execute format('drop policy if exists %I on public.%I', 'phase1 sales roles can update', table_name);
      execute format('drop policy if exists %I on public.%I', 'phase1 sales roles can delete', table_name);

      execute format(
        'create policy %I on public.%I for select to authenticated using (public.is_admin_or_manager() or (public.is_active_member() and public.current_user_role() = ''sales''))',
        'phase1 sales roles can read',
        table_name
      );
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (public.is_admin_or_manager() or (public.is_active_member() and public.current_user_role() = ''sales''))',
        'phase1 sales roles can insert',
        table_name
      );
      execute format(
        'create policy %I on public.%I for update to authenticated using (public.is_admin_or_manager() or (public.is_active_member() and public.current_user_role() = ''sales'')) with check (public.is_admin_or_manager() or (public.is_active_member() and public.current_user_role() = ''sales''))',
        'phase1 sales roles can update',
        table_name
      );
      execute format(
        'create policy %I on public.%I for delete to authenticated using (public.is_admin_or_manager() or (public.is_active_member() and public.current_user_role() = ''sales''))',
        'phase1 sales roles can delete',
        table_name
      );

      execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    end if;
  end loop;
end $$;

-- Extra/admin financial costs stay admin/manager only.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'cost_entries',
    'extra_costs'
  ]
  loop
    if exists (
      select 1
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relname = table_name
        and pg_class.relkind in ('r', 'p')
    ) then
      execute format('alter table public.%I enable row level security', table_name);

      execute format('drop policy if exists %I on public.%I', 'phase1 admin financial read', table_name);
      execute format('drop policy if exists %I on public.%I', 'phase1 admin financial insert', table_name);
      execute format('drop policy if exists %I on public.%I', 'phase1 admin financial update', table_name);
      execute format('drop policy if exists %I on public.%I', 'phase1 admin financial delete', table_name);

      execute format(
        'create policy %I on public.%I for select to authenticated using (public.is_admin_or_manager())',
        'phase1 admin financial read',
        table_name
      );
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (public.is_admin_or_manager())',
        'phase1 admin financial insert',
        table_name
      );
      execute format(
        'create policy %I on public.%I for update to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager())',
        'phase1 admin financial update',
        table_name
      );
      execute format(
        'create policy %I on public.%I for delete to authenticated using (public.is_admin_or_manager())',
        'phase1 admin financial delete',
        table_name
      );

      execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    end if;
  end loop;
end $$;

-- Labor/payroll: admins/managers can see and manage all. Technicians can see
-- and maintain only their own labor rows.
do $$
begin
  if to_regclass('public.labor_logs') is not null then
    alter table public.labor_logs enable row level security;

    drop policy if exists "phase1 labor admin or own read" on public.labor_logs;
    drop policy if exists "phase1 labor admin or own insert" on public.labor_logs;
    drop policy if exists "phase1 labor admin or own update" on public.labor_logs;
    drop policy if exists "phase1 labor admin or own delete" on public.labor_logs;

    create policy "phase1 labor admin or own read"
      on public.labor_logs
      for select
      to authenticated
      using (
        public.is_admin_or_manager()
        or (
          public.is_technician()
          and technician_id = public.current_profile_id()
        )
      );

    create policy "phase1 labor admin or own insert"
      on public.labor_logs
      for insert
      to authenticated
      with check (
        public.is_admin_or_manager()
        or (
          public.is_technician()
          and technician_id = public.current_profile_id()
        )
      );

    create policy "phase1 labor admin or own update"
      on public.labor_logs
      for update
      to authenticated
      using (
        public.is_admin_or_manager()
        or (
          public.is_technician()
          and technician_id = public.current_profile_id()
        )
      )
      with check (
        public.is_admin_or_manager()
        or (
          public.is_technician()
          and technician_id = public.current_profile_id()
        )
      );

    create policy "phase1 labor admin or own delete"
      on public.labor_logs
      for delete
      to authenticated
      using (
        public.is_admin_or_manager()
        or (
          public.is_technician()
          and technician_id = public.current_profile_id()
        )
      );

    grant select, insert, update, delete on table public.labor_logs to authenticated;
  end if;
end $$;

-- Safe prebooking badges expose only status context needed by operational UI.
-- Full customer/deposit/payment rows remain protected by vehicle_prebookings RLS.
do $$
begin
  if to_regclass('public.vehicle_prebookings') is not null then
    execute 'drop view if exists public.active_vehicle_prebooking_badges';
    execute '
      create view public.active_vehicle_prebooking_badges as
      select
        id,
        vehicle_id,
        status,
        created_at
      from public.vehicle_prebookings
      where status = ''active''
        and public.is_active_member()
    ';
    execute 'grant select on table public.active_vehicle_prebooking_badges to authenticated';
  end if;
end $$;

-- If vehicle_investment_summary is exposed separately in Supabase, harden it
-- in a follow-up by making it security_invoker or wrapping it in an
-- admin-filtered view. The frontend should request it only for admin/owner.
