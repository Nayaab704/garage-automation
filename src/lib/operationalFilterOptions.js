import {
  buildSearchText,
  getVehicleContext,
  getVehicleSearchValues,
} from "./searchText";
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

function getVehicleOptionColorStyles(color) {
  const colorDisplay = getVehicleColorDisplay(color);
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
  const colorStyles = getVehicleOptionColorStyles(context.color);

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
