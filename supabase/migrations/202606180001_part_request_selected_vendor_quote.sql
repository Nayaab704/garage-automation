-- Segment 4: remember which historic vendor price was chosen for a part
-- request. Quotes stay in vendor_part_quotes; these fields only store the
-- user's current selection for PO creation.

alter table public.part_requests
  add column if not exists selected_vendor_id uuid null,
  add column if not exists selected_quote_id uuid null,
  add column if not exists quoted_unit_cost numeric null,
  add column if not exists quoted_total_cost numeric null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'part_requests_selected_vendor_id_fkey'
  ) then
    alter table public.part_requests
      add constraint part_requests_selected_vendor_id_fkey
      foreign key (selected_vendor_id)
      references public.vendors(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'part_requests_selected_quote_id_fkey'
  ) then
    alter table public.part_requests
      add constraint part_requests_selected_quote_id_fkey
      foreign key (selected_quote_id)
      references public.vendor_part_quotes(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'part_requests_quoted_unit_cost_non_negative'
  ) then
    alter table public.part_requests
      add constraint part_requests_quoted_unit_cost_non_negative
      check (quoted_unit_cost is null or quoted_unit_cost >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'part_requests_quoted_total_cost_non_negative'
  ) then
    alter table public.part_requests
      add constraint part_requests_quoted_total_cost_non_negative
      check (quoted_total_cost is null or quoted_total_cost >= 0);
  end if;
end $$;

create index if not exists part_requests_selected_vendor_id_idx
  on public.part_requests (selected_vendor_id);

create index if not exists part_requests_selected_quote_id_idx
  on public.part_requests (selected_quote_id);

comment on column public.part_requests.selected_vendor_id is
  'Vendor selected from price memory for the current part request.';

comment on column public.part_requests.selected_quote_id is
  'Historic vendor_part_quotes row selected for this part request.';

comment on column public.part_requests.quoted_unit_cost is
  'Selected quote unit cost used to prefill purchase order creation.';

comment on column public.part_requests.quoted_total_cost is
  'Selected quote total cost snapshot for queue display.';
