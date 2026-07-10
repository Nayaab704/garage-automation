alter table public.vehicles
  add column if not exists color_hex text;

alter table public.vehicles
  drop constraint if exists vehicles_color_hex_format_check;

alter table public.vehicles
  add constraint vehicles_color_hex_format_check
  check (
    color_hex is null
    or color_hex ~ '^#[0-9A-Fa-f]{6}$'
  );

