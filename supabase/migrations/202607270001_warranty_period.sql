-- The existing warranty model uses start_date, end_date, and terms.
-- Keep those canonical columns and add only the missing duration value.
alter table public.warranties
  add column if not exists warranty_months integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'warranties_warranty_months_check'
      and conrelid = 'public.warranties'::regclass
  ) then
    alter table public.warranties
      add constraint warranties_warranty_months_check
      check (
        warranty_months is null
        or warranty_months between 1 and 12
      );
  end if;
end
$$;

create index if not exists warranties_sale_id_idx
  on public.warranties(sale_id);

create index if not exists warranties_end_date_idx
  on public.warranties(end_date);

-- Activity logs are operationally visible to active users, but older sale and
-- prebooking events may contain customer/payment fields inside details. Keep
-- the existing table policies unchanged and give the app a role-aware read
-- view so restricted roles do not receive those details in normal UI queries.
drop view if exists public.activity_logs_visible;

create view public.activity_logs_visible
with (security_invoker = true)
as
select
  id,
  vehicle_id,
  user_id,
  action,
  case
    when public.is_admin_or_manager()
      or (
        public.is_active_member()
        and public.current_user_role() = 'sales'
      )
    then coalesce(details::jsonb, '{}'::jsonb)
    when lower(coalesce(action, '')) ~
      '(sale|sold|warrant|prebook|reservation|deposit|payment|customer|buyer)'
    then '{}'::jsonb
    else coalesce(details::jsonb, '{}'::jsonb) - array[
      'buyer',
      'buyer_email',
      'buyer_name',
      'buyer_phone',
      'customer',
      'customer_email',
      'customer_name',
      'customer_phone',
      'deposit',
      'deposit_amount',
      'deposit_method',
      'deposit_payment_method',
      'email',
      'payment_method',
      'phone',
      'sale_price',
      'sold_price',
      'terms',
      'warranty',
      'warranty_notes',
      'warranty_terms'
    ]
  end as details,
  created_at
from public.activity_logs
where public.is_active_member();

grant select on table public.activity_logs_visible to authenticated;
