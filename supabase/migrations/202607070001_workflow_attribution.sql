alter table public.purchase_orders
  add column if not exists received_by uuid references public.profiles(id) on delete set null;

alter table public.part_requests
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;

create index if not exists purchase_orders_received_by_idx
  on public.purchase_orders (received_by)
  where received_by is not null;

create index if not exists part_requests_approved_by_idx
  on public.part_requests (approved_by)
  where approved_by is not null;
