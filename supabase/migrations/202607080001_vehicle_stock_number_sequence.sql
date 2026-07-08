create sequence if not exists public.vehicle_stock_number_seq
  as bigint
  increment by 1
  minvalue 1
  start with 1001;

do $$
declare
  v_existing_max bigint;
  v_sequence_is_called boolean;
  v_sequence_last_value bigint;
  v_sequence_value bigint;
begin
  select coalesce(
    max(substring(upper(btrim(stock_number)) from '^STK-([0-9]+)$')::bigint),
    1000
  )
    into v_existing_max
  from public.vehicles
  where btrim(stock_number) ~* '^STK-[0-9]+$';

  select last_value, is_called
    into v_sequence_last_value, v_sequence_is_called
  from public.vehicle_stock_number_seq;

  v_sequence_value := case
    when v_sequence_is_called then v_sequence_last_value
    else v_sequence_last_value - 1
  end;

  perform setval(
    'public.vehicle_stock_number_seq',
    greatest(1000, coalesce(v_sequence_value, 1000), v_existing_max),
    true
  );
end $$;

create or replace function public.generate_vehicle_stock_number()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return 'STK-' || nextval('public.vehicle_stock_number_seq')::text;
end;
$$;

create or replace function public.set_vehicle_stock_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(new.stock_number), '') is null then
    new.stock_number := public.generate_vehicle_stock_number();
  end if;

  return new;
end;
$$;

alter table public.vehicles
  alter column stock_number set default public.generate_vehicle_stock_number();

alter sequence public.vehicle_stock_number_seq
  owned by public.vehicles.stock_number;

drop trigger if exists set_vehicle_stock_number_before_insert on public.vehicles;

create trigger set_vehicle_stock_number_before_insert
before insert on public.vehicles
for each row
execute function public.set_vehicle_stock_number();

create unique index if not exists vehicles_stock_number_unique_idx
  on public.vehicles (upper(stock_number))
  where nullif(btrim(stock_number), '') is not null;

grant execute on function public.generate_vehicle_stock_number() to authenticated;
