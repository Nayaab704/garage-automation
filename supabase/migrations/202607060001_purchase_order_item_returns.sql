alter table public.purchase_order_items
  add column if not exists return_status text,
  add column if not exists returned_at timestamptz,
  add column if not exists returned_by uuid references public.profiles(id) on delete set null,
  add column if not exists return_reason text,
  add column if not exists returned_quantity numeric,
  add column if not exists returned_amount numeric,
  add column if not exists returned_shipping_amount numeric default 0,
  add column if not exists return_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_order_items_return_status_check'
      and conrelid = 'public.purchase_order_items'::regclass
  ) then
    alter table public.purchase_order_items
      add constraint purchase_order_items_return_status_check
      check (return_status is null or return_status = 'returned');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_order_items_returned_quantity_check'
      and conrelid = 'public.purchase_order_items'::regclass
  ) then
    alter table public.purchase_order_items
      add constraint purchase_order_items_returned_quantity_check
      check (
        returned_quantity is null
        or (
          returned_quantity >= 0
          and (quantity is null or returned_quantity <= quantity)
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_order_items_returned_amount_check'
      and conrelid = 'public.purchase_order_items'::regclass
  ) then
    alter table public.purchase_order_items
      add constraint purchase_order_items_returned_amount_check
      check (returned_amount is null or returned_amount >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_order_items_returned_shipping_amount_check'
      and conrelid = 'public.purchase_order_items'::regclass
  ) then
    alter table public.purchase_order_items
      add constraint purchase_order_items_returned_shipping_amount_check
      check (
        returned_shipping_amount is null
        or returned_shipping_amount >= 0
      );
  end if;
end $$;

create index if not exists purchase_order_items_return_status_idx
  on public.purchase_order_items (return_status)
  where return_status is not null;
