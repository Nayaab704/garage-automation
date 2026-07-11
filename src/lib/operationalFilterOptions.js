import {
  buildSearchText,
  getVehicleContext,
  getVehicleSearchValues,
} from "./searchText";
import {
  formatPartLabel,
  getPartServiceCategoryFilterValues,
  normalizeServiceCategoryKey,
} from "./partWorkflowUtils";
import { getRepairServiceCategoryFilterValues } from "./repairWorkflowUtils";
import { getVehicleColorDisplay } from "./vehicleColorDisplay";

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function getTime(value) {
  const time = new Date(value ?? 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function cleanVendorName(value) {
  const name = String(value ?? "").trim();
  return name && name !== "Unknown vendor" ? name : "";
}

function getVehicleName(vehicle) {
  return [vehicle?.year, vehicle?.make, vehicle?.model, vehicle?.trim]
    .filter(Boolean)
    .join(" ");
}

function getVehicleModelTrim(vehicle) {
  return [vehicle?.model, vehicle?.trim].filter(Boolean).join(" ");
}

function getVehicleYearMake(vehicle) {
  return [vehicle?.year, vehicle?.make].filter(Boolean).join(" ");
}

export function formatVehicleFilterLabel(vehicle) {
  const context = getVehicleContext(vehicle);

  if (!context) {
    return "Vehicle not found";
  }

  const modelTrim = getVehicleModelTrim(context);
  const yearMake = getVehicleYearMake(context);

  return [modelTrim, yearMake].filter(Boolean).join(" · ") || "Vehicle";
}

function getVehicleShortLabel(vehicle) {
  const context = getVehicleContext(vehicle);
  const modelTrim = getVehicleModelTrim(context);
  const year = context?.year ? String(context.year) : "";

  return [modelTrim, year].filter(Boolean).join(" · ") || modelTrim || "Vehicle";
}

function hexToRgba(hexColor, alpha) {
  const hex = String(hexColor ?? "").replace("#", "");

  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return "";
  }

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getVehicleOptionColorStyles(color, colorHex) {
  const colorDisplay = getVehicleColorDisplay(color, colorHex);
  const dotColor = colorDisplay.dotStyle.backgroundColor;
  const normalizedLabel = String(colorDisplay.label ?? "").toLowerCase();
  const tintSource =
    normalizedLabel.includes("white") || normalizedLabel.includes("silver")
      ? "#94A3B8"
      : dotColor;
  const tintColor =
    hexToRgba(tintSource, 0.08) || "rgba(100, 116, 139, 0.08)";

  return {
    colorDotStyle: colorDisplay.dotStyle,
    colorTintStyle: {
      backgroundColor: tintColor,
    },
  };
}

function createVendorKey({ id, name }) {
  return id ? String(id) : `vendor:${name.toLowerCase()}`;
}

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
  ac: 70,
  audio: 80,
  interior: 90,
  interior_detailing: 90,
  electrical: 100,
};

function getServiceCategoryLabel(category, fallbackValue = "") {
  return (
    String(category?.name ?? "").trim() ||
    formatPartLabel(category?.slug ?? fallbackValue, {})
  );
}

function getServiceCategorySortOrder(categoryKey, category) {
  const sortOrder = Number(category?.sort_order);

  if (Number.isFinite(sortOrder)) {
    return sortOrder;
  }

  return preferredServiceCategoryOrder[categoryKey] ?? Number.MAX_SAFE_INTEGER;
}

function addServiceCategoryOption(optionMap, { category, date, fallbackValue }) {
  const categoryKey = normalizeServiceCategoryKey(
    category?.slug ?? category?.name ?? fallbackValue
  );
  const label = getServiceCategoryLabel(category, fallbackValue);

  if (!categoryKey || !label) {
    return;
  }

  const existingOption = optionMap.get(categoryKey);
  const serviceCategoryId =
    existingOption?.serviceCategoryId ||
    (category?.id ? String(category.id) : "");

  optionMap.set(categoryKey, {
    description: "",
    id: categoryKey,
    label,
    lastUsedAt: Math.max(existingOption?.lastUsedAt ?? 0, getTime(date)),
    searchText: buildSearchText([
      existingOption?.searchText,
      label,
      category?.slug,
      fallbackValue,
    ]),
    serviceCategoryId,
    serviceCategoryKey: categoryKey,
    shortLabel: label,
    sortOrder: Math.min(
      existingOption?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      getServiceCategorySortOrder(categoryKey, category)
    ),
  });
}

function addVendorOption(optionMap, { date, email, id, name, phone }) {
  const label = cleanVendorName(name);

  if (!id && !label) {
    return;
  }

  const optionId = createVendorKey({ id, name: label });
  const existingOption = optionMap.get(optionId);
  const searchValues = [
    existingOption?.searchText,
    label,
    phone,
    email,
  ];

  optionMap.set(optionId, {
    description: [phone, email].filter(Boolean).join(" - "),
    id: optionId,
    label: label || "Selected vendor",
    lastUsedAt: Math.max(existingOption?.lastUsedAt ?? 0, getTime(date)),
    searchText: buildSearchText(searchValues),
    vendorId: id ? String(id) : "",
  });
}

function addVehicleOption(optionMap, { date, vehicle }) {
  const context = getVehicleContext(vehicle);

  if (!context?.id) {
    return;
  }

  const existingOption = optionMap.get(String(context.id));
  const vehicleName = getVehicleName(context);
  const label = formatVehicleFilterLabel(context);
  const colorStyles = getVehicleOptionColorStyles(
    context.color,
    context.color_hex
  );

  optionMap.set(String(context.id), {
    description: "",
    id: String(context.id),
    kind: "vehicle",
    label,
    lastUsedAt: Math.max(existingOption?.lastUsedAt ?? 0, getTime(date)),
    searchText: buildSearchText([
      existingOption?.searchText,
      label,
      ...getVehicleSearchValues(context),
    ]),
    shortLabel: getVehicleShortLabel(context),
    ...colorStyles,
    vehicleId: String(context.id),
    vehicleName,
  });
}

function finalizeOptions(optionMap) {
  const options = [...optionMap.values()];
  const recentIds = new Set(
    options
      .filter((option) => option.lastUsedAt > 0)
      .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
      .slice(0, 5)
      .map((option) => option.id)
  );

  return options
    .map((option) => ({
      ...option,
      isRecent: recentIds.has(option.id),
    }))
    .sort((left, right) => {
      if (left.isRecent !== right.isRecent) {
        return left.isRecent ? -1 : 1;
      }

      if (left.isRecent && left.lastUsedAt !== right.lastUsedAt) {
        return right.lastUsedAt - left.lastUsedAt;
      }

      return left.label.localeCompare(right.label);
    });
}

function getQuoteVendorName(quote) {
  return cleanVendorName(
    quote?.vendor_name_snapshot ||
      quote?.display_vendor_name ||
      quote?.vendor?.name
  );
}

function addPartVendorUsage(optionMap, part) {
  const partDate = part?.created_at;

  addVendorOption(optionMap, {
    date: partDate,
    id: part?.selected_vendor_id ?? part?.selectedVendor?.id,
    name: part?.selectedVendor?.name,
  });

  for (const quote of [
    part?.selectedQuote,
    part?.latestQuote,
    ...(part?.quotes ?? []),
  ]) {
    addVendorOption(optionMap, {
      date: quote?.quoted_at ?? quote?.created_at ?? partDate,
      id: quote?.vendor_id,
      name: getQuoteVendorName(quote),
    });
  }

  for (const item of part?.purchaseOrderItems ?? []) {
    addVendorOption(optionMap, {
      date:
        item?.purchaseOrder?.ordered_at ??
        item?.purchaseOrder?.created_at ??
        item?.created_at ??
        partDate,
      id: item?.purchaseOrder?.vendor_id ?? item?.purchaseOrder?.vendor?.id,
      name: item?.purchaseOrder?.vendor?.name,
    });
  }
}

export function getPartsVendorFilterOptions(parts = [], vendors = []) {
  const optionMap = new Map();

  for (const vendor of vendors) {
    addVendorOption(optionMap, {
      email: vendor.email,
      id: vendor.id,
      name: vendor.name,
      phone: vendor.phone,
    });
  }

  for (const part of parts) {
    addPartVendorUsage(optionMap, part);
  }

  return finalizeOptions(optionMap);
}

export function getPartsVehicleFilterOptions(parts = []) {
  const optionMap = new Map();

  for (const part of parts) {
    addVehicleOption(optionMap, {
      date: part?.created_at,
      vehicle: part?.vehicle ?? part?.vehicleContext,
    });
    addVehicleOption(optionMap, {
      date: part?.repairJob?.created_at ?? part?.created_at,
      vehicle: part?.repairJob?.vehicle ?? part?.repairJob?.vehicleContext,
    });
  }

  return finalizeOptions(optionMap);
}

export function getPartsServiceCategoryFilterOptions(
  parts = [],
  serviceCategories = []
) {
  const optionMap = new Map();

  for (const category of serviceCategories) {
    if (category?.is_active === false) {
      continue;
    }

    addServiceCategoryOption(optionMap, { category });
  }

  for (const part of parts) {
    const workOrder = part?.repairJob ?? part?.repair_job ?? part?.repair_jobs;
    const serviceCategory = workOrder?.serviceCategory ?? null;
    const { serviceCategoryKey } = getPartServiceCategoryFilterValues(part);
    const fallbackValue = workOrder?.category ?? part?.category ?? serviceCategoryKey;

    addServiceCategoryOption(optionMap, {
      category: serviceCategory,
      date: part?.created_at ?? workOrder?.created_at,
      fallbackValue,
    });
  }

  return [...optionMap.values()].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.label.localeCompare(right.label);
  });
}

export function getRepairsVehicleFilterOptions(jobs = []) {
  const optionMap = new Map();

  for (const job of jobs) {
    addVehicleOption(optionMap, {
      date: job?.created_at,
      vehicle: job?.vehicle,
    });
  }

  return finalizeOptions(optionMap);
}

export function getRepairsServiceCategoryFilterOptions(
  jobs = [],
  serviceCategories = []
) {
  const optionMap = new Map();

  for (const category of serviceCategories) {
    if (category?.is_active === false) {
      continue;
    }

    addServiceCategoryOption(optionMap, { category });
  }

  for (const job of jobs) {
    const { serviceCategoryKey } = getRepairServiceCategoryFilterValues(job);
    const fallbackValue = job?.category ?? serviceCategoryKey;

    addServiceCategoryOption(optionMap, {
      category: job?.serviceCategory,
      date: job?.created_at,
      fallbackValue,
    });
  }

  return [...optionMap.values()].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.label.localeCompare(right.label);
  });
}

export function getPurchaseOrderVendorFilterOptions(
  purchaseOrders = [],
  vendorsById = {}
) {
  const optionMap = new Map();

  for (const vendor of Object.values(vendorsById)) {
    addVendorOption(optionMap, {
      email: vendor.email,
      id: vendor.id,
      name: vendor.name,
      phone: vendor.phone,
    });
  }

  for (const purchaseOrder of purchaseOrders) {
    addVendorOption(optionMap, {
      date: purchaseOrder.ordered_at ?? purchaseOrder.created_at,
      email: purchaseOrder.vendor?.email,
      id: purchaseOrder.vendor_id ?? purchaseOrder.vendor?.id,
      name: purchaseOrder.vendor?.name,
      phone: purchaseOrder.vendor?.phone,
    });

    for (const item of purchaseOrder.items ?? []) {
      addVendorOption(optionMap, {
        date: item.created_at ?? purchaseOrder.created_at,
        id: item.partRequest?.selected_vendor_id,
        name: getQuoteVendorName(item.partRequest?.selectedQuote),
      });
    }
  }

  return finalizeOptions(optionMap);
}

export function getPurchaseOrderVehicleFilterOptions(purchaseOrders = []) {
  const optionMap = new Map();

  for (const purchaseOrder of purchaseOrders) {
    const date = purchaseOrder.ordered_at ?? purchaseOrder.created_at;

    addVehicleOption(optionMap, {
      date,
      vehicle: purchaseOrder.vehicle ?? purchaseOrder.vehicleContext,
    });

    for (const vehicle of purchaseOrder.vehicleContexts ?? []) {
      addVehicleOption(optionMap, { date, vehicle });
    }

    for (const item of purchaseOrder.items ?? []) {
      addVehicleOption(optionMap, {
        date: item.created_at ?? date,
        vehicle: item.vehicle ?? item.vehicleContext,
      });
      addVehicleOption(optionMap, {
        date: item.created_at ?? date,
        vehicle: item.partRequest?.vehicle ?? item.partRequest?.vehicleContext,
      });
      addVehicleOption(optionMap, {
        date: item.created_at ?? date,
        vehicle:
          item.partRequest?.repairJob?.vehicle ??
          item.partRequest?.repairJob?.vehicleContext,
      });
    }
  }

  return finalizeOptions(optionMap);
}

export function getOptionById(options = [], optionId = "") {
  return options.find((option) => option.id === optionId) ?? null;
}

export function getActiveFilterCount(values = []) {
  return uniqueValues(values).length;
}
