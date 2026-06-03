const defaultVisual = {
  accentClassName: "border-slate-200 bg-white text-slate-600",
  icon: "toolbox",
  shortLabel: "Other",
};

const phaseOneServiceCategorySlugs = new Set([
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
  other: defaultVisual,
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

export function getServiceCategoryVisual(categoryOrSlug) {
  const slug =
    typeof categoryOrSlug === "string"
      ? categoryOrSlug
      : categoryOrSlug?.slug;

  return serviceCategoryVisuals[slug] ?? defaultVisual;
}

export function isPhaseOneServiceCategory(categoryOrSlug) {
  const slug =
    typeof categoryOrSlug === "string"
      ? categoryOrSlug
      : categoryOrSlug?.slug;
  const normalizedSlug = String(slug ?? "").trim().toLowerCase();

  if (phaseOneServiceCategorySlugs.has(normalizedSlug)) {
    return true;
  }

  const normalizedName = String(categoryOrSlug?.name ?? "")
    .trim()
    .toLowerCase();

  return phaseOneServiceCategoryNames.has(normalizedName);
}

export function getPhaseOneServiceCategories(serviceCategories = []) {
  return serviceCategories.filter((serviceCategory) =>
    isPhaseOneServiceCategory(serviceCategory)
  );
}
