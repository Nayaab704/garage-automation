import { supabase } from "./supabaseClient";
import {
  getPurchaseOrderItemNetTotal,
  purchaseOrderItemReturnColumns,
} from "./partReturns";

const vendorColumns =
  "id, name, phone, email, address, vendor_type, notes, created_at";

const vendorQuoteColumns =
  "id, vendor_id, vendor_name_snapshot, vehicle_id, repair_job_id, part_request_id, purchase_order_id, purchase_order_item_id, raw_part_name, normalized_part_name, quantity, unit_price, shipping_cost, tax_cost, total_price, quote_status, availability, notes, quoted_at, created_by, created_at, stock_number_snapshot, vehicle_year_snapshot, vehicle_make_snapshot, vehicle_model_snapshot, vehicle_trim_snapshot";

const purchaseOrderColumns =
  "id, vehicle_id, vendor_id, status, ordered_at, received_at, created_at";

const purchaseOrderItemColumns =
  `id, purchase_order_id, part_request_id, description, quantity, unit_cost, shipping_cost, tax, status, notes, created_at, ${purchaseOrderItemReturnColumns}`;

const partRequestColumns =
  "id, vehicle_id, repair_job_id, part_name, quantity, status";

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function numberOrZero(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeName(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getDateTime(value) {
  const date = new Date(value ?? 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getItemTotal(item) {
  return getPurchaseOrderItemNetTotal(item);
}

function getQuoteTotal(quote) {
  const savedTotal = Number(quote.total_price);

  if (Number.isFinite(savedTotal) && savedTotal > 0) {
    return savedTotal;
  }

  return (
    numberOrZero(quote.quantity || 1) * numberOrZero(quote.unit_price) +
    numberOrZero(quote.shipping_cost) +
    numberOrZero(quote.tax_cost)
  );
}

function getServiceCategory(repairJob, serviceCategoriesById) {
  return repairJob?.service_category_id
    ? serviceCategoriesById[repairJob.service_category_id] ?? null
    : null;
}

function getQuoteVendorId(quote, vendorIdByName) {
  return (
    quote.vendor_id ??
    vendorIdByName[normalizeName(quote.vendor_name_snapshot)] ??
    null
  );
}

function mapQuoteHistoryEntry({
  profilesById,
  quote,
  repairJobsById,
  serviceCategoriesById,
  vehiclesById,
}) {
  const vehicle = vehiclesById[quote.vehicle_id] ?? null;
  const repairJob = repairJobsById[quote.repair_job_id] ?? null;
  const serviceCategory = getServiceCategory(repairJob, serviceCategoriesById);
  const date = quote.quoted_at ?? quote.created_at;

  return {
    availability: quote.availability,
    createdByProfile: profilesById[quote.created_by] ?? null,
    date,
    id: `quote-${quote.id}`,
    isPurchased: quote.quote_status === "purchased",
    notes: quote.notes,
    partName: quote.raw_part_name || "Unnamed part",
    quantity: numberOrZero(quote.quantity || 1),
    quoteStatus: quote.quote_status || "quoted",
    repairJob,
    serviceCategory,
    source: "quote",
    totalPrice: getQuoteTotal(quote),
    unitPrice: numberOrZero(quote.unit_price),
    vehicle,
    vehicleSnapshot: {
      make: quote.vehicle_make_snapshot,
      model: quote.vehicle_model_snapshot,
      stockNumber: quote.stock_number_snapshot,
      trim: quote.vehicle_trim_snapshot,
      year: quote.vehicle_year_snapshot,
    },
  };
}

function mapPurchaseHistoryEntry({
  item,
  partRequestsById,
  purchaseOrder,
  repairJobsById,
  serviceCategoriesById,
  vehiclesById,
}) {
  const partRequest = partRequestsById[item.part_request_id] ?? null;
  const vehicle =
    vehiclesById[purchaseOrder.vehicle_id] ??
    vehiclesById[partRequest?.vehicle_id] ??
    null;
  const repairJob = repairJobsById[partRequest?.repair_job_id] ?? null;
  const serviceCategory = getServiceCategory(repairJob, serviceCategoriesById);
  const date =
    purchaseOrder.received_at ?? purchaseOrder.ordered_at ?? item.created_at;

  return {
    availability: null,
    date,
    id: `po-item-${item.id}`,
    isPurchased: true,
    notes: item.notes,
    partName: item.description || partRequest?.part_name || "Unnamed part",
    quantity: numberOrZero(item.quantity || 1),
    quoteStatus: "purchased",
    repairJob,
    serviceCategory,
    source: "purchase_order",
    totalPrice: getItemTotal(item),
    unitPrice: numberOrZero(item.unit_cost),
    vehicle,
    vehicleSnapshot: null,
  };
}

function getEmptyVendorStats() {
  return {
    lastUsedAt: null,
    purchasedCount: 0,
    quoteCount: 0,
    totalSpend: 0,
  };
}

export function withEmptyVendorStats(vendor) {
  return {
    ...vendor,
    history: [],
    stats: getEmptyVendorStats(),
  };
}

function enrichVendor(vendor, history) {
  const sortedHistory = [...history].sort((left, right) => {
    const dateDifference = getDateTime(right.date) - getDateTime(left.date);

    if (dateDifference !== 0) {
      return dateDifference;
    }

    if (left.isPurchased === right.isPurchased) {
      return 0;
    }

    return left.isPurchased ? -1 : 1;
  });
  const quoteCount = sortedHistory.filter(
    (entry) => entry.source === "quote"
  ).length;
  const purchasedEntries = sortedHistory.filter((entry) => entry.isPurchased);

  return {
    ...vendor,
    history: sortedHistory,
    stats: {
      lastUsedAt: sortedHistory[0]?.date ?? null,
      purchasedCount: purchasedEntries.length,
      quoteCount,
      totalSpend: purchasedEntries.reduce(
        (total, entry) => total + numberOrZero(entry.totalPrice),
        0
      ),
    },
  };
}

export async function fetchVendorsWithStats() {
  const [vendorsResponse, quotesResponse, purchaseOrdersResponse] =
    await Promise.all([
      supabase
        .from("vendors")
        .select(vendorColumns)
        .order("created_at", { ascending: false }),
      supabase
        .from("vendor_part_quotes")
        .select(vendorQuoteColumns)
        .order("quoted_at", { ascending: false }),
      supabase
        .from("purchase_orders")
        .select(purchaseOrderColumns)
        .order("created_at", { ascending: false }),
    ]);

  const firstError =
    vendorsResponse.error ?? quotesResponse.error ?? purchaseOrdersResponse.error;

  if (firstError) {
    return { data: null, error: firstError };
  }

  const vendors = vendorsResponse.data ?? [];
  const quotes = quotesResponse.data ?? [];
  const purchaseOrders = purchaseOrdersResponse.data ?? [];
  const purchaseOrderIds = uniqueValues(
    purchaseOrders.map((purchaseOrder) => purchaseOrder.id)
  );

  const purchaseOrderItemsResponse =
    purchaseOrderIds.length > 0
      ? await supabase
          .from("purchase_order_items")
          .select(purchaseOrderItemColumns)
          .in("purchase_order_id", purchaseOrderIds)
      : { data: [], error: null };

  if (purchaseOrderItemsResponse.error) {
    return { data: null, error: purchaseOrderItemsResponse.error };
  }

  const purchaseOrderItems = purchaseOrderItemsResponse.data ?? [];
  const partRequestIds = uniqueValues([
    ...purchaseOrderItems.map((item) => item.part_request_id),
    ...quotes.map((quote) => quote.part_request_id),
  ]);

  const partRequestsResponse =
    partRequestIds.length > 0
      ? await supabase
          .from("part_requests")
          .select(partRequestColumns)
          .in("id", partRequestIds)
      : { data: [], error: null };

  if (partRequestsResponse.error) {
    return { data: null, error: partRequestsResponse.error };
  }

  const partRequests = partRequestsResponse.data ?? [];
  const profileIds = uniqueValues(quotes.map((quote) => quote.created_by));
  const profilesResponse =
    profileIds.length > 0
      ? await supabase
          .from("profile_display_names")
          .select("id, full_name, email")
          .in("id", profileIds)
      : { data: [], error: null };

  if (profilesResponse.error) {
    return { data: null, error: profilesResponse.error };
  }

  const vehicleIds = uniqueValues([
    ...purchaseOrders.map((purchaseOrder) => purchaseOrder.vehicle_id),
    ...partRequests.map((partRequest) => partRequest.vehicle_id),
    ...quotes.map((quote) => quote.vehicle_id),
  ]);
  const repairJobIds = uniqueValues([
    ...partRequests.map((partRequest) => partRequest.repair_job_id),
    ...quotes.map((quote) => quote.repair_job_id),
  ]);

  const [vehiclesResponse, repairJobsResponse, serviceCategoriesResponse] =
    await Promise.all([
      vehicleIds.length > 0
        ? supabase
            .from("vehicles")
            .select(
              "id, stock_number, vin, year, make, model, trim, color, color_hex, status"
            )
            .in("id", vehicleIds)
        : { data: [], error: null },
      repairJobIds.length > 0
        ? supabase
            .from("repair_jobs")
            .select("id, vehicle_id, service_category_id, title, category")
            .in("id", repairJobIds)
        : { data: [], error: null },
      supabase
        .from("service_categories")
        .select("id, slug, name, description, sort_order, is_active"),
    ]);

  const relatedError =
    vehiclesResponse.error ??
    repairJobsResponse.error ??
    serviceCategoriesResponse.error;

  if (relatedError) {
    return { data: null, error: relatedError };
  }

  const vendorIdByName = Object.fromEntries(
    vendors.map((vendor) => [normalizeName(vendor.name), vendor.id])
  );
  const historyByVendorId = Object.fromEntries(
    vendors.map((vendor) => [vendor.id, []])
  );
  const vehiclesById = Object.fromEntries(
    (vehiclesResponse.data ?? []).map((vehicle) => [vehicle.id, vehicle])
  );
  const repairJobsById = Object.fromEntries(
    (repairJobsResponse.data ?? []).map((repairJob) => [repairJob.id, repairJob])
  );
  const serviceCategoriesById = Object.fromEntries(
    (serviceCategoriesResponse.data ?? []).map((category) => [
      category.id,
      category,
    ])
  );
  const partRequestsById = Object.fromEntries(
    partRequests.map((partRequest) => [partRequest.id, partRequest])
  );
  const profilesById = Object.fromEntries(
    (profilesResponse.data ?? []).map((profile) => [profile.id, profile])
  );
  const purchaseOrdersById = Object.fromEntries(
    purchaseOrders.map((purchaseOrder) => [purchaseOrder.id, purchaseOrder])
  );
  const quotePurchaseOrderItemIds = new Set(
    quotes
      .map((quote) => quote.purchase_order_item_id)
      .filter(Boolean)
  );

  for (const quote of quotes) {
    const vendorId = getQuoteVendorId(quote, vendorIdByName);

    if (!vendorId || !historyByVendorId[vendorId]) {
      continue;
    }

    historyByVendorId[vendorId].push(
      mapQuoteHistoryEntry({
        profilesById,
        quote,
        repairJobsById,
        serviceCategoriesById,
        vehiclesById,
      })
    );
  }

  for (const item of purchaseOrderItems) {
    if (quotePurchaseOrderItemIds.has(item.id)) {
      continue;
    }

    const purchaseOrder = purchaseOrdersById[item.purchase_order_id];
    const vendorId = purchaseOrder?.vendor_id;

    if (!vendorId || !historyByVendorId[vendorId]) {
      continue;
    }

    historyByVendorId[vendorId].push(
      mapPurchaseHistoryEntry({
        item,
        partRequestsById,
        purchaseOrder,
        repairJobsById,
        serviceCategoriesById,
        vehiclesById,
      })
    );
  }

  const enrichedVendors = vendors.map((vendor) =>
    enrichVendor(vendor, historyByVendorId[vendor.id] ?? [])
  );
  const purchasedEntries = enrichedVendors.flatMap((vendor) =>
    vendor.history.filter((entry) => entry.isPurchased)
  );

  return {
    data: {
      summary: {
        purchasedParts: purchasedEntries.length,
        quotesSaved: quotes.length,
        totalSpend: purchasedEntries.reduce(
          (total, entry) => total + numberOrZero(entry.totalPrice),
          0
        ),
        totalVendors: vendors.length,
      },
      vendors: enrichedVendors,
    },
    error: null,
  };
}
