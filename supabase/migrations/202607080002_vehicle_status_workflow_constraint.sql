alter table public.vehicles
  alter column status set default 'inspection';

update public.vehicles
set status = case
  when regexp_replace(lower(btrim(coalesce(status, ''))), '[[:space:]-]+', '_', 'g')
    in ('', 'inspection', 'needed', 'not_started') then 'inspection'
  when regexp_replace(lower(btrim(coalesce(status, ''))), '[[:space:]-]+', '_', 'g')
    in (
      'in_progress',
      'in_repair',
      'parts_needed',
      'repair',
      'repairing',
      'waiting_for_parts',
      'waiting_parts'
    ) then 'repair'
  when regexp_replace(lower(btrim(coalesce(status, ''))), '[[:space:]-]+', '_', 'g')
    in ('quality_check', 'qc') then 'quality_check'
  when regexp_replace(lower(btrim(coalesce(status, ''))), '[[:space:]-]+', '_', 'g')
    in ('archived', 'ready', 'ready_for_sale', 'sold') then 'ready_for_sale'
  else 'inspection'
end
where status is distinct from case
  when regexp_replace(lower(btrim(coalesce(status, ''))), '[[:space:]-]+', '_', 'g')
    in ('', 'inspection', 'needed', 'not_started') then 'inspection'
  when regexp_replace(lower(btrim(coalesce(status, ''))), '[[:space:]-]+', '_', 'g')
    in (
      'in_progress',
      'in_repair',
      'parts_needed',
      'repair',
      'repairing',
      'waiting_for_parts',
      'waiting_parts'
    ) then 'repair'
  when regexp_replace(lower(btrim(coalesce(status, ''))), '[[:space:]-]+', '_', 'g')
    in ('quality_check', 'qc') then 'quality_check'
  when regexp_replace(lower(btrim(coalesce(status, ''))), '[[:space:]-]+', '_', 'g')
    in ('archived', 'ready', 'ready_for_sale', 'sold') then 'ready_for_sale'
  else 'inspection'
end;

alter table public.vehicles
  drop constraint if exists vehicles_status_check;

alter table public.vehicles
  add constraint vehicles_status_check
  check (
    status is not null
    and status in (
      'inspection',
      'repair',
      'quality_check',
      'ready_for_sale'
    )
  );
