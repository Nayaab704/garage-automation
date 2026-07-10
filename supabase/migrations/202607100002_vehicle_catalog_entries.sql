create table if not exists public.vehicle_catalog_entries (
  id uuid primary key default gen_random_uuid(),
  make text not null,
  model text,
  trim text,
  normalized_make text not null,
  normalized_model text,
  normalized_trim text,
  usage_count integer not null default 0,
  source text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_catalog_entries_usage_count_check
    check (usage_count >= 0)
);

create or replace function public.normalize_vehicle_catalog_text(value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(btrim(coalesce(value, ''))), '\s+', ' ', 'g'), '');
$$;

create or replace function public.set_vehicle_catalog_entries_normalized()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.make := btrim(new.make);
  new.model := nullif(btrim(coalesce(new.model, '')), '');
  new.trim := nullif(btrim(coalesce(new.trim, '')), '');
  new.normalized_make := public.normalize_vehicle_catalog_text(new.make);
  new.normalized_model := public.normalize_vehicle_catalog_text(new.model);
  new.normalized_trim := public.normalize_vehicle_catalog_text(new.trim);
  new.updated_at := now();

  if new.normalized_make is null then
    raise exception 'Vehicle catalog make is required';
  end if;

  return new;
end;
$$;

drop trigger if exists set_vehicle_catalog_entries_normalized
  on public.vehicle_catalog_entries;

create trigger set_vehicle_catalog_entries_normalized
before insert or update on public.vehicle_catalog_entries
for each row
execute function public.set_vehicle_catalog_entries_normalized();

create unique index if not exists vehicle_catalog_entries_normalized_unique_idx
  on public.vehicle_catalog_entries (
    normalized_make,
    coalesce(normalized_model, ''),
    coalesce(normalized_trim, '')
  );

create index if not exists vehicle_catalog_entries_make_idx
  on public.vehicle_catalog_entries (normalized_make);

create index if not exists vehicle_catalog_entries_model_idx
  on public.vehicle_catalog_entries (normalized_make, normalized_model)
  where normalized_model is not null;

create or replace function public.record_vehicle_catalog_entry(
  p_make text,
  p_model text default null,
  p_trim text default null,
  p_source text default 'user'
)
returns public.vehicle_catalog_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_make text := btrim(coalesce(p_make, ''));
  clean_model text := nullif(btrim(coalesce(p_model, '')), '');
  clean_trim text := nullif(btrim(coalesce(p_trim, '')), '');
  next_source text := coalesce(nullif(btrim(p_source), ''), 'user');
  make_key text := public.normalize_vehicle_catalog_text(p_make);
  model_key text := public.normalize_vehicle_catalog_text(p_model);
  trim_key text := public.normalize_vehicle_catalog_text(p_trim);
  matched_id uuid;
  next_usage_increment integer := case when next_source = 'seed' then 0 else 1 end;
  saved_entry public.vehicle_catalog_entries;
begin
  if make_key is null then
    return null;
  end if;

  select id
    into matched_id
  from public.vehicle_catalog_entries
  where normalized_make = make_key
    and coalesce(normalized_model, '') = coalesce(model_key, '')
    and coalesce(normalized_trim, '') = coalesce(trim_key, '')
  limit 1;

  if matched_id is null then
    insert into public.vehicle_catalog_entries (
      make,
      model,
      trim,
      normalized_make,
      normalized_model,
      normalized_trim,
      usage_count,
      source
    )
    values (
      clean_make,
      clean_model,
      clean_trim,
      make_key,
      model_key,
      trim_key,
      next_usage_increment,
      next_source
    )
    returning * into saved_entry;
  else
    update public.vehicle_catalog_entries
       set make = clean_make,
           model = clean_model,
           trim = clean_trim,
           usage_count = usage_count + next_usage_increment,
           updated_at = now()
     where id = matched_id
     returning * into saved_entry;
  end if;

  return saved_entry;
end;
$$;

alter table public.vehicle_catalog_entries enable row level security;

drop policy if exists "vehicle catalog entries are readable by active users"
  on public.vehicle_catalog_entries;

create policy "vehicle catalog entries are readable by active users"
  on public.vehicle_catalog_entries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.auth_user_id = auth.uid()
        and coalesce(profiles.is_active, true) = true
    )
  );

grant select on table public.vehicle_catalog_entries to authenticated;
grant execute on function public.record_vehicle_catalog_entry(text, text, text, text)
  to authenticated;

select public.record_vehicle_catalog_entry(make, model, trim, 'seed')
from (
  values
    ('Toyota', null, null),
    ('Honda', null, null),
    ('Ford', null, null),
    ('Chevrolet', null, null),
    ('Nissan', null, null),
    ('Hyundai', null, null),
    ('Kia', null, null),
    ('BMW', null, null),
    ('Mercedes-Benz', null, null),
    ('Audi', null, null),
    ('Volkswagen', null, null),
    ('Lexus', null, null),
    ('Acura', null, null),
    ('Mazda', null, null),
    ('Subaru', null, null),
    ('Jeep', null, null),
    ('Dodge', null, null),
    ('Tesla', null, null),
    ('GMC', null, null),
    ('Ram', null, null),
    ('Toyota', 'Camry', 'LE'),
    ('Toyota', 'Camry', 'SE'),
    ('Toyota', 'Camry', 'XLE'),
    ('Toyota', 'Camry', 'XSE'),
    ('Toyota', 'Camry', 'Hybrid LE'),
    ('Toyota', 'Camry', 'Hybrid SE'),
    ('Toyota', 'Corolla', 'LE'),
    ('Toyota', 'Corolla', 'SE'),
    ('Toyota', 'Corolla', 'XLE'),
    ('Toyota', 'Corolla', 'XSE'),
    ('Toyota', 'Corolla', 'Hybrid LE'),
    ('Toyota', 'RAV4', 'LE'),
    ('Toyota', 'RAV4', 'XLE'),
    ('Toyota', 'RAV4', 'XLE Premium'),
    ('Toyota', 'RAV4', 'Adventure'),
    ('Toyota', 'RAV4', 'Limited'),
    ('Toyota', '4Runner', 'SR5'),
    ('Toyota', '4Runner', 'TRD Off-Road'),
    ('Toyota', '4Runner', 'Limited'),
    ('Toyota', 'Highlander', 'LE'),
    ('Toyota', 'Highlander', 'XLE'),
    ('Toyota', 'Highlander', 'Limited'),
    ('Toyota', 'Highlander', 'Platinum'),
    ('Toyota', 'Prius', 'LE'),
    ('Toyota', 'Prius', 'XLE'),
    ('Toyota', 'Prius', 'Limited'),
    ('Honda', 'Civic', 'LX'),
    ('Honda', 'Civic', 'Sport'),
    ('Honda', 'Civic', 'EX'),
    ('Honda', 'Civic', 'Touring'),
    ('Honda', 'Accord', 'LX'),
    ('Honda', 'Accord', 'Sport'),
    ('Honda', 'Accord', 'EX-L'),
    ('Honda', 'Accord', 'Touring'),
    ('Honda', 'CR-V', 'LX'),
    ('Honda', 'CR-V', 'EX'),
    ('Honda', 'CR-V', 'EX-L'),
    ('Honda', 'CR-V', 'Touring'),
    ('Honda', 'Pilot', 'EX-L'),
    ('Honda', 'Pilot', 'Touring'),
    ('Honda', 'Pilot', 'Elite'),
    ('Honda', 'Odyssey', 'EX-L'),
    ('Honda', 'Odyssey', 'Touring'),
    ('Honda', 'Odyssey', 'Elite'),
    ('BMW', '3 Series', '330i'),
    ('BMW', '3 Series', '330e'),
    ('BMW', '3 Series', 'M340i'),
    ('BMW', '5 Series', '530i'),
    ('BMW', '5 Series', '540i'),
    ('BMW', 'X3', 'sDrive30i'),
    ('BMW', 'X3', 'xDrive30i'),
    ('BMW', 'X3', 'M40i'),
    ('BMW', 'X5', 'sDrive40i'),
    ('BMW', 'X5', 'xDrive40i'),
    ('BMW', 'X5', 'M60i'),
    ('Audi', 'A3', 'Premium'),
    ('Audi', 'A3', 'Premium Plus'),
    ('Audi', 'A4', 'Premium'),
    ('Audi', 'A4', 'Premium Plus'),
    ('Audi', 'A4', 'Prestige'),
    ('Audi', 'Q5', 'Premium'),
    ('Audi', 'Q5', 'Premium Plus'),
    ('Audi', 'Q5', 'Prestige'),
    ('Audi', 'Q7', 'Premium'),
    ('Audi', 'Q7', 'Premium Plus'),
    ('Audi', 'Q7', 'Prestige'),
    ('Tesla', 'Model 3', 'Standard Range'),
    ('Tesla', 'Model 3', 'Long Range'),
    ('Tesla', 'Model 3', 'Performance'),
    ('Tesla', 'Model Y', 'Long Range'),
    ('Tesla', 'Model Y', 'Performance'),
    ('Tesla', 'Model S', 'Long Range'),
    ('Tesla', 'Model S', 'Plaid'),
    ('Tesla', 'Model X', 'Long Range'),
    ('Tesla', 'Model X', 'Plaid'),
    ('Ford', 'F-150', 'XL'),
    ('Ford', 'F-150', 'XLT'),
    ('Ford', 'F-150', 'Lariat'),
    ('Ford', 'F-150', 'King Ranch'),
    ('Ford', 'F-150', 'Platinum'),
    ('Ford', 'Escape', 'S'),
    ('Ford', 'Escape', 'SE'),
    ('Ford', 'Escape', 'SEL'),
    ('Ford', 'Escape', 'Titanium'),
    ('Ford', 'Explorer', 'XLT'),
    ('Ford', 'Explorer', 'Limited'),
    ('Ford', 'Explorer', 'ST'),
    ('Ford', 'Explorer', 'Platinum'),
    ('Ford', 'Mustang', 'EcoBoost'),
    ('Ford', 'Mustang', 'GT'),
    ('Ford', 'Mustang', 'Mach 1'),
    ('Chevrolet', 'Malibu', 'LS'),
    ('Chevrolet', 'Malibu', 'LT'),
    ('Chevrolet', 'Malibu', 'Premier'),
    ('Chevrolet', 'Equinox', 'LS'),
    ('Chevrolet', 'Equinox', 'LT'),
    ('Chevrolet', 'Equinox', 'Premier'),
    ('Chevrolet', 'Tahoe', 'LS'),
    ('Chevrolet', 'Tahoe', 'LT'),
    ('Chevrolet', 'Tahoe', 'Premier'),
    ('Chevrolet', 'Tahoe', 'High Country'),
    ('Chevrolet', 'Silverado 1500', 'WT'),
    ('Chevrolet', 'Silverado 1500', 'LT'),
    ('Chevrolet', 'Silverado 1500', 'RST'),
    ('Chevrolet', 'Silverado 1500', 'LTZ'),
    ('Chevrolet', 'Silverado 1500', 'High Country'),
    ('Nissan', 'Altima', 'S'),
    ('Nissan', 'Altima', 'SV'),
    ('Nissan', 'Altima', 'SR'),
    ('Nissan', 'Altima', 'SL'),
    ('Nissan', 'Sentra', 'S'),
    ('Nissan', 'Sentra', 'SV'),
    ('Nissan', 'Sentra', 'SR'),
    ('Nissan', 'Rogue', 'S'),
    ('Nissan', 'Rogue', 'SV'),
    ('Nissan', 'Rogue', 'SL'),
    ('Nissan', 'Rogue', 'Platinum'),
    ('Nissan', 'Pathfinder', 'S'),
    ('Nissan', 'Pathfinder', 'SV'),
    ('Nissan', 'Pathfinder', 'SL'),
    ('Nissan', 'Pathfinder', 'Platinum'),
    ('Hyundai', 'Elantra', 'SE'),
    ('Hyundai', 'Elantra', 'SEL'),
    ('Hyundai', 'Elantra', 'Limited'),
    ('Hyundai', 'Elantra', 'N Line'),
    ('Hyundai', 'Sonata', 'SE'),
    ('Hyundai', 'Sonata', 'SEL'),
    ('Hyundai', 'Sonata', 'Limited'),
    ('Hyundai', 'Sonata', 'N Line'),
    ('Hyundai', 'Tucson', 'SE'),
    ('Hyundai', 'Tucson', 'SEL'),
    ('Hyundai', 'Tucson', 'Limited'),
    ('Hyundai', 'Santa Fe', 'SE'),
    ('Hyundai', 'Santa Fe', 'SEL'),
    ('Hyundai', 'Santa Fe', 'Limited'),
    ('Hyundai', 'Santa Fe', 'Calligraphy'),
    ('Kia', 'Forte', 'LX'),
    ('Kia', 'Forte', 'LXS'),
    ('Kia', 'Forte', 'GT-Line'),
    ('Kia', 'Forte', 'GT'),
    ('Kia', 'K5', 'LXS'),
    ('Kia', 'K5', 'GT-Line'),
    ('Kia', 'K5', 'EX'),
    ('Kia', 'K5', 'GT'),
    ('Kia', 'Sportage', 'LX'),
    ('Kia', 'Sportage', 'EX'),
    ('Kia', 'Sportage', 'SX'),
    ('Kia', 'Sportage', 'SX Prestige'),
    ('Kia', 'Telluride', 'LX'),
    ('Kia', 'Telluride', 'S'),
    ('Kia', 'Telluride', 'EX'),
    ('Kia', 'Telluride', 'SX')
) as seed(make, model, trim);
