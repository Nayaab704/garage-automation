create table if not exists public.vehicle_prebookings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  customer_name text,
  customer_phone text,
  customer_email text,
  deposit_amount numeric not null default 0,
  payment_method text,
  deposit_date date,
  status text not null default 'active',
  notes text,
  receipt_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  refund_amount numeric,
  refund_date date,
  constraint vehicle_prebookings_status_check
    check (status in ('active', 'cancelled', 'refunded', 'applied_to_sale')),
  constraint vehicle_prebookings_deposit_amount_check
    check (deposit_amount >= 0),
  constraint vehicle_prebookings_refund_amount_check
    check (refund_amount is null or refund_amount >= 0)
);

create index if not exists vehicle_prebookings_vehicle_id_idx
  on public.vehicle_prebookings(vehicle_id);

create index if not exists vehicle_prebookings_status_idx
  on public.vehicle_prebookings(status);

create unique index if not exists vehicle_prebookings_one_active_per_vehicle_idx
  on public.vehicle_prebookings(vehicle_id)
  where status = 'active';

create or replace function public.set_vehicle_prebookings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_vehicle_prebookings_updated_at
  on public.vehicle_prebookings;

create trigger set_vehicle_prebookings_updated_at
before update on public.vehicle_prebookings
for each row
execute function public.set_vehicle_prebookings_updated_at();

create or replace view public.active_vehicle_prebooking_badges as
select
  id,
  vehicle_id,
  status,
  deposit_amount,
  created_at
from public.vehicle_prebookings
where status = 'active';

alter table public.vehicle_prebookings enable row level security;

drop policy if exists "vehicle prebookings can be managed by sales roles"
  on public.vehicle_prebookings;

create policy "vehicle prebookings can be managed by sales roles"
  on public.vehicle_prebookings
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.auth_user_id = auth.uid()
        and coalesce(profiles.is_active, true) = true
        and profiles.role in ('owner', 'admin', 'sales')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.auth_user_id = auth.uid()
        and coalesce(profiles.is_active, true) = true
        and profiles.role in ('owner', 'admin', 'sales')
    )
  );

grant select, insert, update on table public.vehicle_prebookings to authenticated;
grant select on table public.active_vehicle_prebooking_badges to authenticated;
