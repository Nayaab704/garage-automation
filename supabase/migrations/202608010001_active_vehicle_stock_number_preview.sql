-- Stock numbers are scoped to vehicles that are still in the operational
-- vehicles table. Archived records and vendor quote snapshots intentionally do
-- not participate, so a cleared demo inventory starts again at STK-1.

create or replace function public.get_next_vehicle_stock_number()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 'STK-' || (
    coalesce(
      max(
        substring(
          upper(btrim(vehicles.stock_number))
          from '^STK-([0-9]+)$'
        )::bigint
      ),
      0
    ) + 1
  )::text
  from public.vehicles
  where btrim(vehicles.stock_number) ~* '^STK-[0-9]+$';
$$;

comment on function public.get_next_vehicle_stock_number() is
  'Previews the next STK number using only rows currently in public.vehicles.';

-- Automatic inserts use the exact same helper as Intake. The transaction lock
-- serializes automatic allocations without reserving or consuming a preview.
create or replace function public.generate_vehicle_stock_number()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('public.vehicles.stock_number', 0)
  );

  return public.get_next_vehicle_stock_number();
end;
$$;

-- Explicit Intake previews are serialized by the existing insert trigger too.
-- A stale preview can fail cleanly on the unique index, but it can never be
-- silently replaced with a different saved stock number.
create or replace function public.set_vehicle_stock_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('public.vehicles.stock_number', 0)
  );

  if nullif(btrim(new.stock_number), '') is null then
    new.stock_number := public.get_next_vehicle_stock_number();
  end if;

  return new;
end;
$$;

revoke all on function public.get_next_vehicle_stock_number() from public;
revoke all on function public.get_next_vehicle_stock_number() from anon;
grant execute on function public.get_next_vehicle_stock_number()
  to authenticated, service_role;

revoke all on function public.generate_vehicle_stock_number() from public;
revoke all on function public.generate_vehicle_stock_number() from anon;
grant execute on function public.generate_vehicle_stock_number()
  to authenticated, service_role;
