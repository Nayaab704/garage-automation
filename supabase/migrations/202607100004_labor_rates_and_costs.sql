alter table public.profiles
  add column if not exists hourly_rate numeric not null default 0;

alter table public.labor_logs
  add column if not exists hourly_rate numeric not null default 0,
  add column if not exists labor_cost numeric not null default 0;

update public.profiles
set hourly_rate = 0
where hourly_rate is null;

alter table public.profiles
  alter column hourly_rate set default 0,
  alter column hourly_rate set not null;

update public.labor_logs
set hourly_rate = 0
where hourly_rate is null;

update public.labor_logs
set labor_cost = 0
where labor_cost is null;

alter table public.labor_logs
  alter column hourly_rate set default 0,
  alter column hourly_rate set not null,
  alter column labor_cost set default 0,
  alter column labor_cost set not null;

alter table public.profiles
  drop constraint if exists profiles_hourly_rate_nonnegative_check;

alter table public.profiles
  add constraint profiles_hourly_rate_nonnegative_check
  check (hourly_rate >= 0);

alter table public.labor_logs
  drop constraint if exists labor_logs_hourly_rate_nonnegative_check;

alter table public.labor_logs
  add constraint labor_logs_hourly_rate_nonnegative_check
  check (hourly_rate >= 0);

alter table public.labor_logs
  drop constraint if exists labor_logs_labor_cost_nonnegative_check;

alter table public.labor_logs
  add constraint labor_logs_labor_cost_nonnegative_check
  check (labor_cost >= 0);

update public.labor_logs
set hourly_rate = coalesce(nullif(public.labor_logs.hourly_rate, 0), profiles.hourly_rate, 0)
from public.profiles
where public.labor_logs.technician_id = profiles.id
  and public.labor_logs.hours is not null;

update public.labor_logs
set labor_cost = round((coalesce(hours, 0) * coalesce(hourly_rate, 0))::numeric, 2)
where hours is not null;

create or replace function public.set_labor_log_cost()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.hourly_rate := greatest(coalesce(new.hourly_rate, 0), 0);
  new.labor_cost := round(
    (greatest(coalesce(new.hours, 0), 0) * new.hourly_rate)::numeric,
    2
  );
  return new;
end;
$$;

drop trigger if exists set_labor_log_cost_before_write
  on public.labor_logs;

create trigger set_labor_log_cost_before_write
before insert or update of hours, hourly_rate, technician_id on public.labor_logs
for each row
execute function public.set_labor_log_cost();
