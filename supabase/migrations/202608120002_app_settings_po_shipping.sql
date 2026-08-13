create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid null references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('default_po_shipping_cost', '0'::jsonb)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app settings active member read" on public.app_settings;
drop policy if exists "app settings admin insert" on public.app_settings;
drop policy if exists "app settings admin update" on public.app_settings;

create policy "app settings active member read"
  on public.app_settings
  for select
  to authenticated
  using (
    public.is_admin_or_manager()
    or (
      key = 'default_po_shipping_cost'
      and public.is_active_member()
    )
  );

create policy "app settings admin insert"
  on public.app_settings
  for insert
  to authenticated
  with check (public.is_admin_or_manager());

create policy "app settings admin update"
  on public.app_settings
  for update
  to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

revoke all on table public.app_settings from public;
revoke all on table public.app_settings from anon;
grant select, insert, update on table public.app_settings to authenticated;

comment on table public.app_settings is
  'Small workspace-level settings. Writes are restricted to active owner/admin/manager profiles.';
