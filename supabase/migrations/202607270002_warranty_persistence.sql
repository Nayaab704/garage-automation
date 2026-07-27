-- Reassert the existing warranty access model without changing warranty data
-- or introducing a second warranty schema.
alter table public.warranties enable row level security;

drop policy if exists "phase1 sales roles can read" on public.warranties;
drop policy if exists "phase1 sales roles can insert" on public.warranties;
drop policy if exists "phase1 sales roles can update" on public.warranties;
drop policy if exists "phase1 sales roles can delete" on public.warranties;

create policy "phase1 sales roles can read"
  on public.warranties
  for select
  to authenticated
  using (
    public.is_admin_or_manager()
    or (
      public.is_active_member()
      and public.current_user_role() = 'sales'
    )
  );

create policy "phase1 sales roles can insert"
  on public.warranties
  for insert
  to authenticated
  with check (
    public.is_admin_or_manager()
    or (
      public.is_active_member()
      and public.current_user_role() = 'sales'
    )
  );

create policy "phase1 sales roles can update"
  on public.warranties
  for update
  to authenticated
  using (
    public.is_admin_or_manager()
    or (
      public.is_active_member()
      and public.current_user_role() = 'sales'
    )
  )
  with check (
    public.is_admin_or_manager()
    or (
      public.is_active_member()
      and public.current_user_role() = 'sales'
    )
  );

create policy "phase1 sales roles can delete"
  on public.warranties
  for delete
  to authenticated
  using (
    public.is_admin_or_manager()
    or (
      public.is_active_member()
      and public.current_user_role() = 'sales'
    )
  );

grant select, insert, update, delete on table public.warranties
  to authenticated;
