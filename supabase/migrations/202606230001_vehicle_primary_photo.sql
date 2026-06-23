-- Adds an explicit main/profile photo pointer for vehicles.
-- Run this manually in Supabase SQL Editor before using Change Main Photo.

alter table public.vehicles
add column if not exists primary_photo_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.vehicles'::regclass
      and conname = 'vehicles_primary_photo_id_fkey'
  ) then
    alter table public.vehicles
    add constraint vehicles_primary_photo_id_fkey
    foreign key (primary_photo_id)
    references public.vehicle_photos(id)
    on delete set null;
  end if;
end $$;

create index if not exists vehicles_primary_photo_id_idx
on public.vehicles(primary_photo_id);
