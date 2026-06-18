import {
  getPartSearchTerms,
  normalizePartName,
  tokenizePartName,
} from "./partNameUtils";
import { supabase } from "./supabaseClient";

export const vendorQuoteStatuses = [
  "quoted",
  "purchased",
  "rejected",
  "unavailable",
];

export const vendorAvailabilityStatuses = [
  "in_stock",
  "order_needed",
  "unavailable",
  "unknown",
];

function emptyToNull(value) {
  const trimmedValue = String(value ?? "").trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function numberOrDefault(value, defaultValue = 0) {
  const numberValue = Number(value ?? defaultValue);
  return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function positiveNumberOrDefault(value, defaultValue = 1) {
  const numberValue = Number(value ?? defaultValue);
  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : defaultValue;
}

function integerOrNull(value) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) ? numberValue : null;
}

function firstValue(record, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = record?.[fieldName];

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

function getVendorName(vendor) {
  return firstValue(vendor, ["name", "vendor_name", "company_name"]);
}

export function getVendorQuoteDisplayName(quote) {
  return (
    firstValue(quote, [
      "vendor_name_snapshot",
      "vendor_name",
      "display_vendor_name",
    ]) ?? "Unknown vendor"
  );
}

function mapVendorQuoteForDisplay(quote) {
  if (!quote) {
    return quote;
  }

  const displayVendorName = getVendorQuoteDisplayName(quote);

  return {
    ...quote,
    display_vendor_name: displayVendorName,
    vendor_name_snapshot: quote.vendor_name_snapshot ?? quote.vendor_name ?? null,
  };
}

function getPartName({ partName, partRequest, purchaseOrderItem }) {
  return (
    emptyToNull(partName) ??
    firstValue(partRequest, ["part_name", "name", "part"]) ??
    firstValue(purchaseOrderItem, ["description", "part_name", "name"])
  );
}

function getValidQuoteStatus(value, fallback = "quoted") {
  return vendorQuoteStatuses.includes(value) ? value : fallback;
}

function getValidAvailability(value) {
  return vendorAvailabilityStatuses.includes(value) ? value : "unknown";
}

function getFriendlyError(error, fallbackMessage) {
  if (!error) {
    return null;
  }

  const message = String(error.message ?? "");

  if (message.toLowerCase().includes("part name")) {
    return new Error("Part name is required.");
  }

  if (message.toLowerCase().includes("permission")) {
    return new Error("You do not have permission to use vendor price memory.");
  }

  return new Error(fallbackMessage);
}

export function buildVendorPartQuotePayload({
  availability = "unknown",
  createdBy = null,
  currentProfile = null,
  notes = "",
  partCategory = null,
  partName,
  partRequest = null,
  price = {},
  purchaseOrder = null,
  purchaseOrderItem = null,
  quoteStatus,
  quotedAt = null,
  repairJob = null,
  vendor = null,
  vehicle = null,
} = {}) {
  const rawPartName = getPartName({ partName, partRequest, purchaseOrderItem });
  const normalizedPartName = normalizePartName(rawPartName);
  const quantity = positiveNumberOrDefault(
    price.quantity ?? purchaseOrderItem?.quantity ?? partRequest?.quantity,
    1
  );
  const unitPrice = numberOrDefault(
    price.unitPrice ??
      price.unit_price ??
      purchaseOrderItem?.unit_cost ??
      partRequest?.unit_cost,
    0
  );
  const shippingCost = numberOrDefault(
    price.shippingCost ?? price.shipping_cost ?? purchaseOrderItem?.shipping_cost,
    0
  );
  const taxCost = numberOrDefault(
    price.taxCost ?? price.tax_cost ?? price.tax ?? purchaseOrderItem?.tax,
    0
  );
  const fallbackQuoteStatus =
    purchaseOrder?.id || purchaseOrderItem?.id ? "purchased" : "quoted";

  // raw_part_name preserves what the user saw/typed; normalized_part_name is
  // only for matching similar future part searches.
  return {
    availability: getValidAvailability(availability),
    created_by: createdBy ?? currentProfile?.id ?? null,
    notes: emptyToNull(notes),
    normalized_part_name: normalizedPartName,
    part_category: emptyToNull(partCategory ?? repairJob?.category),
    part_request_id: partRequest?.id ?? null,
    purchase_order_id: purchaseOrder?.id ?? purchaseOrderItem?.purchase_order_id ?? null,
    purchase_order_item_id: purchaseOrderItem?.id ?? null,
    quantity,
    quote_status: getValidQuoteStatus(quoteStatus, fallbackQuoteStatus),
    quoted_at: quotedAt ?? new Date().toISOString(),
    raw_part_name: rawPartName,
    repair_job_id: repairJob?.id ?? partRequest?.repair_job_id ?? null,
    shipping_cost: shippingCost,
    stock_number_snapshot: emptyToNull(vehicle?.stock_number),
    tax_cost: taxCost,
    unit_price: unitPrice,
    vehicle_id: vehicle?.id ?? partRequest?.vehicle_id ?? purchaseOrder?.vehicle_id ?? null,
    vehicle_make_snapshot: emptyToNull(vehicle?.make),
    vehicle_model_snapshot: emptyToNull(vehicle?.model),
    vehicle_trim_snapshot: emptyToNull(vehicle?.trim),
    vehicle_year_snapshot: integerOrNull(vehicle?.year),
    vendor_id: vendor?.id ?? purchaseOrder?.vendor_id ?? null,
    vendor_name_snapshot: emptyToNull(getVendorName(vendor)),
  };
}

export async function searchVendorPartQuotes({
  limit = 8,
  partName,
  vehicle = null,
} = {}) {
  const normalizedPartName = normalizePartName(partName);

  if (!normalizedPartName) {
    return { data: [], error: null };
  }

  try {
    const { data, error } = await supabase.rpc("search_vendor_part_quotes", {
      p_limit: limit,
      p_part_name: normalizedPartName,
      p_vehicle_make: vehicle?.make ?? null,
      p_vehicle_model: vehicle?.model ?? null,
      p_vehicle_year: integerOrNull(vehicle?.year),
    });

    if (error) {
      console.error("Vendor price memory search failed:", error);
      return {
        data: [],
        error: getFriendlyError(error, "Unable to search previous vendor prices."),
      };
    }

    return { data: (data ?? []).map(mapVendorQuoteForDisplay), error: null };
  } catch (error) {
    console.error("Vendor price memory search failed:", error);
    return {
      data: [],
      error: new Error("Unable to search previous vendor prices."),
    };
  }
}

export async function createVendorPartQuote(payload = {}) {
  const rawPartName = emptyToNull(payload.raw_part_name ?? payload.part_name);
  const normalizedPartName = normalizePartName(
    payload.normalized_part_name ?? rawPartName
  );

  if (!rawPartName || !normalizedPartName) {
    return { data: null, error: new Error("Part name is required.") };
  }

  const quotePayload = {
    ...payload,
    availability: getValidAvailability(payload.availability),
    normalized_part_name: normalizedPartName,
    quantity: positiveNumberOrDefault(payload.quantity, 1),
    quote_status: getValidQuoteStatus(payload.quote_status),
    raw_part_name: rawPartName,
    shipping_cost: numberOrDefault(payload.shipping_cost, 0),
    tax_cost: numberOrDefault(payload.tax_cost, 0),
    unit_price: numberOrDefault(payload.unit_price, 0),
  };

  delete quotePayload.part_name;
  delete quotePayload.total_price;

  try {
    const { data, error } = await supabase
      .from("vendor_part_quotes")
      .insert([quotePayload])
      .select("*")
      .single();

    if (error) {
      console.error("Vendor price memory save failed:", error);
      return {
        data: null,
        error: getFriendlyError(
          error,
          "Could not save vendor quote. Please try again."
        ),
      };
    }

    return { data: mapVendorQuoteForDisplay(data), error: null };
  } catch (error) {
    console.error("Vendor price memory save failed:", error);
    return {
      data: null,
      error: new Error("Could not save vendor quote. Please try again."),
    };
  }
}

export async function markQuotePurchased({
  purchaseOrderId = null,
  purchaseOrderItemId = null,
  quoteId,
} = {}) {
  if (!quoteId) {
    return { data: null, error: new Error("Quote ID is required.") };
  }

  try {
    const { data, error } = await supabase
      .from("vendor_part_quotes")
      .update({
        purchase_order_id: purchaseOrderId,
        purchase_order_item_id: purchaseOrderItemId,
        quote_status: "purchased",
      })
      .eq("id", quoteId)
      .select("*")
      .single();

    if (error) {
      console.error("Vendor price memory update failed:", error);
      return {
        data: null,
        error: getFriendlyError(error, "Unable to update vendor price history."),
      };
    }

    return { data: mapVendorQuoteForDisplay(data), error: null };
  } catch (error) {
    console.error("Vendor price memory update failed:", error);
    return {
      data: null,
      error: new Error("Unable to update vendor price history."),
    };
  }
}

export async function linkVendorPartQuoteToPartRequest({
  partRequestId,
  quoteId,
  repairJobId = null,
  vehicleId = null,
} = {}) {
  if (!quoteId || !partRequestId) {
    return { data: null, error: null };
  }

  try {
    const updatePayload = {
      part_request_id: partRequestId,
    };

    if (repairJobId) {
      updatePayload.repair_job_id = repairJobId;
    }

    if (vehicleId) {
      updatePayload.vehicle_id = vehicleId;
    }

    const { data, error } = await supabase
      .from("vendor_part_quotes")
      .update(updatePayload)
      .eq("id", quoteId)
      .select("*")
      .single();

    if (error) {
      console.error("Vendor price memory link failed:", error);
      return {
        data: null,
        error: getFriendlyError(error, "Unable to link vendor price history."),
      };
    }

    return { data: mapVendorQuoteForDisplay(data), error: null };
  } catch (error) {
    console.error("Vendor price memory link failed:", error);
    return {
      data: null,
      error: new Error("Unable to link vendor price history."),
    };
  }
}

export { getPartSearchTerms, normalizePartName, tokenizePartName };
