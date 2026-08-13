alter table public.purchase_orders
  add column if not exists cancelled_by uuid null references public.profiles(id) on delete set null,
  add column if not exists cancelled_at timestamptz null;

alter table public.purchase_order_items
  add column if not exists cancelled_by uuid null references public.profiles(id) on delete set null,
  add column if not exists cancelled_at timestamptz null;

alter table public.part_requests
  add column if not exists cancelled_by uuid null references public.profiles(id) on delete set null,
  add column if not exists cancelled_at timestamptz null;

create index if not exists purchase_orders_cancelled_by_idx
  on public.purchase_orders (cancelled_by)
  where cancelled_by is not null;

create index if not exists purchase_order_items_cancelled_by_idx
  on public.purchase_order_items (cancelled_by)
  where cancelled_by is not null;

create index if not exists part_requests_cancelled_by_idx
  on public.part_requests (cancelled_by)
  where cancelled_by is not null;

comment on column public.purchase_orders.cancelled_by is
  'Profile that cancelled the purchase order. Null for legacy cancellation records.';
comment on column public.purchase_order_items.cancelled_by is
  'Profile that cancelled the purchase order item. Null for legacy cancellation records.';
comment on column public.part_requests.cancelled_by is
  'Profile that cancelled the part request. Null for legacy cancellation records.';
