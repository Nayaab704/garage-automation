-- vendor_part_quotes is reusable business memory, not vehicle-owned data.
-- Repair older/deviated schemas where part_request_id may still cascade so
-- deleting an expired vehicle's part requests can only detach quote history.

alter table public.vendor_part_quotes
  alter column part_request_id drop not null;

do $$
declare
  v_constraint_name text;
begin
  for v_constraint_name in
    select constraint_row.conname
    from pg_constraint as constraint_row
    join pg_attribute as attribute_row
      on attribute_row.attrelid = constraint_row.conrelid
     and attribute_row.attnum = any(constraint_row.conkey)
    where constraint_row.contype = 'f'
      and constraint_row.conrelid =
        'public.vendor_part_quotes'::regclass
      and attribute_row.attname = 'part_request_id'
  loop
    execute format(
      'alter table public.vendor_part_quotes drop constraint %I',
      v_constraint_name
    );
  end loop;

  alter table public.vendor_part_quotes
    add constraint vendor_part_quotes_part_request_id_fkey
    foreign key (part_request_id)
    references public.part_requests(id)
    on delete set null
    not valid;
end
$$;

-- NOT VALID keeps the lock window small while the final validation still
-- guarantees every existing non-null link is valid. No quote row is rewritten
-- or removed by this migration.
alter table public.vendor_part_quotes
  validate constraint vendor_part_quotes_part_request_id_fkey;

comment on column public.vendor_part_quotes.part_request_id is
  'Optional live workflow link. Deleting a part request sets this to null and preserves the reusable vendor quote.';
