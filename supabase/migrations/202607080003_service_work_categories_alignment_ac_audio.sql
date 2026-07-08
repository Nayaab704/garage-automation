with desired_categories(slug, name, description, sort_order) as (
  values
    (
      'alignment',
      'Alignment',
      'Wheel alignment and steering tracking work.',
      60
    ),
    (
      'ac',
      'AC',
      'Air conditioning diagnosis and repair work.',
      70
    ),
    (
      'audio',
      'Audio',
      'Audio, speaker, stereo, and infotainment work.',
      80
    )
),
desired_category_aliases(slug, alias) as (
  values
    ('alignment', 'alignment'),
    ('ac', 'ac'),
    ('ac', 'a_c'),
    ('ac', 'air_conditioning'),
    ('audio', 'audio'),
    ('audio', 'sound'),
    ('audio', 'stereo')
)
insert into public.service_categories (
  slug,
  name,
  description,
  sort_order,
  is_active
)
select
  desired_categories.slug,
  desired_categories.name,
  desired_categories.description,
  desired_categories.sort_order,
  true
from desired_categories
where not exists (
  select 1
  from public.service_categories existing_category
  join desired_category_aliases
    on desired_category_aliases.slug = desired_categories.slug
  where regexp_replace(
      lower(btrim(coalesce(existing_category.slug, ''))),
      '[^a-z0-9]+',
      '_',
      'g'
    ) = desired_category_aliases.alias
    or regexp_replace(
      lower(btrim(coalesce(existing_category.name, ''))),
      '[^a-z0-9]+',
      '_',
      'g'
    ) = desired_category_aliases.alias
);

with desired_categories(slug, name, description, sort_order) as (
  values
    (
      'alignment',
      'Alignment',
      'Wheel alignment and steering tracking work.',
      60
    ),
    (
      'ac',
      'AC',
      'Air conditioning diagnosis and repair work.',
      70
    ),
    (
      'audio',
      'Audio',
      'Audio, speaker, stereo, and infotainment work.',
      80
    )
),
desired_category_aliases(slug, alias) as (
  values
    ('alignment', 'alignment'),
    ('ac', 'ac'),
    ('ac', 'a_c'),
    ('ac', 'air_conditioning'),
    ('audio', 'audio'),
    ('audio', 'sound'),
    ('audio', 'stereo')
)
update public.service_categories existing_category
set
  is_active = true,
  sort_order = desired_categories.sort_order,
  name = case
    when regexp_replace(
      lower(btrim(coalesce(existing_category.slug, ''))),
      '[^a-z0-9]+',
      '_',
      'g'
    ) = desired_categories.slug then desired_categories.name
    else existing_category.name
  end,
  description = coalesce(
    nullif(btrim(existing_category.description), ''),
    desired_categories.description
  )
from desired_categories
where exists (
  select 1
  from desired_category_aliases
  where desired_category_aliases.slug = desired_categories.slug
    and (
      regexp_replace(
        lower(btrim(coalesce(existing_category.slug, ''))),
        '[^a-z0-9]+',
        '_',
        'g'
      ) = desired_category_aliases.alias
      or regexp_replace(
        lower(btrim(coalesce(existing_category.name, ''))),
        '[^a-z0-9]+',
        '_',
        'g'
      ) = desired_category_aliases.alias
    )
);
