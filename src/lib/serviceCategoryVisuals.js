const defaultVisual = {
  accentClassName: "border-slate-200 bg-white text-slate-600",
  icon: "toolbox",
  shortLabel: "Other",
};

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
