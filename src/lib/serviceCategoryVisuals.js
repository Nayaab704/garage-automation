const defaultVisual = {
  accentClassName: "border-slate-200 bg-white text-slate-600",
  icon: "toolbox",
  shortLabel: "Service",
};

const phaseOneServiceCategorySlugs = new Set([
  "ac",
  "a_c",
  "air_conditioning",
  "alignment",
  "audio",
  "body",
  "body_shop",
  "electrical",
  "glass",
  "interior",
  "interior_detailing",
  "mechanical",
  "paint",
  "paint_cosmetic",
  "tires",
  "tires_wheels",
]);

const phaseOneServiceCategoryNames = new Set([
  "a/c",
  "ac",
  "air conditioning",
  "alignment",
  "audio",
  "body",
  "body shop",
  "electrical",
  "glass",
  "interior",
  "interior detailing",
  "interior / detailing",
  "mechanical",
  "paint",
  "paint cosmetic",
  "paint / cosmetic",
  "tires",
  "tires wheels",
  "tires / wheels",
]);

export const serviceCategoryVisuals = {
  a_c: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "snowflake",
    shortLabel: "AC",
  },
  ac: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "snowflake",
    shortLabel: "AC",
  },
  air_conditioning: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "snowflake",
    shortLabel: "AC",
  },
  alignment: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "wheel",
    shortLabel: "Alignment",
  },
  audio: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "volume",
    shortLabel: "Audio",
  },
  body: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "body-shop",
    shortLabel: "Body",
  },
  body_shop: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "body-shop",
    shortLabel: "Body Shop",
  },
  electrical: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "lightning",
    shortLabel: "Electrical",
  },
  glass: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "glass",
    shortLabel: "Glass",
  },
  interior: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "seat",
    shortLabel: "Interior",
  },
  interior_detailing: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "seat",
    shortLabel: "Interior",
  },
  mechanical: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "wrench",
    shortLabel: "Mechanical",
  },
  paint: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "paint-spray",
    shortLabel: "Paint",
  },
  paint_cosmetic: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "paint-spray",
    shortLabel: "Paint",
  },
  parts: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "box",
    shortLabel: "Parts",
  },
  parts_accessories: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "box",
    shortLabel: "Parts",
  },
  tires: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "wheel",
    shortLabel: "Tires",
  },
  tires_wheels: {
    accentClassName: "border-slate-200 bg-white text-slate-600",
    icon: "wheel",
    shortLabel: "Tires",
  },
};

const preferredServiceCategoryOrder = {
  mechanical: 10,
  body: 20,
  body_shop: 20,
  paint: 30,
  paint_cosmetic: 30,
  glass: 40,
  tires: 50,
  tires_wheels: 50,
  alignment: 60,
  a_c: 70,
  ac: 70,
  air_conditioning: 70,
  audio: 80,
  interior: 90,
  interior_detailing: 90,
  electrical: 100,
};

function normalizeCategoryKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getCategoryOrder(category) {
  const slugOrder = preferredServiceCategoryOrder[
    normalizeCategoryKey(category?.slug)
  ];

  if (slugOrder !== undefined) {
    return slugOrder;
  }

  const nameOrder = preferredServiceCategoryOrder[
    normalizeCategoryKey(category?.name)
  ];

  return nameOrder ?? Number.MAX_SAFE_INTEGER;
}

export function getServiceCategoryVisual(categoryOrSlug) {
  const slug =
    typeof categoryOrSlug === "string"
      ? categoryOrSlug
      : categoryOrSlug?.slug;
  const normalizedSlug = normalizeCategoryKey(slug);
  const normalizedName = normalizeCategoryKey(categoryOrSlug?.name);

  return (
    serviceCategoryVisuals[normalizedSlug] ??
    serviceCategoryVisuals[normalizedName] ??
    defaultVisual
  );
}

export function isPhaseOneServiceCategory(categoryOrSlug) {
  const slug =
    typeof categoryOrSlug === "string"
      ? categoryOrSlug
      : categoryOrSlug?.slug;
  const normalizedSlug = normalizeCategoryKey(slug);

  if (phaseOneServiceCategorySlugs.has(normalizedSlug)) {
    return true;
  }

  const normalizedName = String(categoryOrSlug?.name ?? "")
    .trim()
    .toLowerCase();

  return (
    phaseOneServiceCategoryNames.has(normalizedName) ||
    phaseOneServiceCategorySlugs.has(normalizeCategoryKey(normalizedName))
  );
}

export function getPhaseOneServiceCategories(serviceCategories = []) {
  return serviceCategories
    .filter((serviceCategory) => isPhaseOneServiceCategory(serviceCategory))
    .sort((firstCategory, secondCategory) => {
      const firstOrder = getCategoryOrder(firstCategory);
      const secondOrder = getCategoryOrder(secondCategory);

      if (firstOrder !== secondOrder) {
        return firstOrder - secondOrder;
      }

      const firstSortOrder = firstCategory.sort_order ?? 0;
      const secondSortOrder = secondCategory.sort_order ?? 0;

      if (firstSortOrder !== secondSortOrder) {
        return firstSortOrder - secondSortOrder;
      }

      return String(firstCategory.name ?? "").localeCompare(
        String(secondCategory.name ?? "")
      );
    });
}
