create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  customer_name text,
  customer_phone text,
  sale_price numeric,
  sale_date date default current_date,
  payment_method text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.sales
  add column if not exists customer_name text;

alter table public.sales
  add column if not exists customer_phone text;

alter table public.sales
  add column if not exists sale_price numeric;

alter table public.sales
  add column if not exists sale_date date default current_date;

alter table public.sales
  add column if not exists payment_method text;

alter table public.sales
  add column if not exists notes text;

alter table public.sales
  add column if not exists created_at timestamptz not null default now();

alter table public.vehicles
  add column if not exists sale_status text not null default 'available';

alter table public.vehicles
  drop constraint if exists vehicles_sale_status_check;

alter table public.vehicles
  add constraint vehicles_sale_status_check
  check (sale_status in ('available', 'sold'));

create index if not exists vehicles_sale_status_idx
  on public.vehicles(sale_status);

create index if not exists sales_vehicle_id_idx
  on public.sales(vehicle_id);

update public.vehicles
set sale_status = 'sold'
where exists (
  select 1
  from public.sales
  where sales.vehicle_id = vehicles.id
);

create or replace function public.sync_vehicle_sale_status_from_sales()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.vehicles
    set sale_status = 'sold'
    where id = new.vehicle_id;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    update public.vehicles
    set sale_status = 'sold'
    where id = new.vehicle_id;

    if old.vehicle_id is distinct from new.vehicle_id then
      update public.vehicles
      set sale_status = case
        when exists (
          select 1 from public.sales where sales.vehicle_id = old.vehicle_id
        )
        then 'sold'
        else 'available'
      end
      where id = old.vehicle_id;
    end if;

    return new;
  end if;

  update public.vehicles
  set sale_status = case
    when exists (
      select 1 from public.sales where sales.vehicle_id = old.vehicle_id
    )
    then 'sold'
    else 'available'
  end
  where id = old.vehicle_id;

  return old;
end;
$$;

drop trigger if exists sync_vehicle_sale_status_from_sales
  on public.sales;

create trigger sync_vehicle_sale_status_from_sales
after insert or update or delete on public.sales
for each row
execute function public.sync_vehicle_sale_status_from_sales();
