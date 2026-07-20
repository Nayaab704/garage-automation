import {
  filterPartsQueue,
  getPartQueueCounts,
  getPartQueueSearchText,
} from "./partWorkflowUtils";
import { purchaseOrderItemReturnColumns } from "./partReturns";
import {
  buildVehicleSearchIndex,
  getVehicleContext,
  getVehicleSearchText,
} from "./searchText";
import { getVendorQuoteDisplayName } from "./vendorPriceMemory";
import { supabase } from "./supabaseClient";

const partRequestColumns =
  "id, vehicle_id, repair_job_id, part_name, quantity, status, notes, part_source, approval_status, approved_by, approved_at, unit_cost, selected_vendor_id, selected_quote_id, quoted_unit_cost, quoted_total_cost, created_by, created_at";

const purchaseOrderColumns =
  "id, vehicle_id, vendor_id, status, ordered_by, ordered_at, received_by, received_at, notes, created_at";

const purchaseOrderItemColumns =
  `id, purchase_order_id, part_request_id, description, quantity, unit_cost, shipping_cost, tax, status, notes, created_at, ${purchaseOrderItemReturnColumns}`;

const vendorPartQuoteColumns =
  "id, vendor_id, vendor_name_snapshot, vehicle_id, repair_job_id, part_request_id, purchase_order_id, purchase_order_item_id, raw_part_name, normalized_part_name, quantity, unit_price, shipping_cost, tax_cost, total_price, quote_status, availability, notes, quoted_at, created_by, created_at";

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function groupBy(records, key) {
  return records.reduce((groupedRecords, record) => {
    const groupKey =
      typeof key === "function" ? key(record) : record?.[key];

    if (!groupKey) {
      return groupedRecords;
    }

    groupedRecords[groupKey] = [...(groupedRecords[groupKey] ?? []), record];
    return groupedRecords;
  }, {});
}

function latestQuoteFirst(left, right) {
  const leftDate = new Date(left.quoted_at ?? left.created_at ?? 0).getTime();
  const rightDate = new Date(right.quoted_at ?? right.created_at ?? 0).getTime();

  return rightDate - leftDate;
}

function enrichPart({
  part,
  profilesById,
  purchaseOrderItemsByPartRequestId,
  purchaseOrdersById,
  quotesById,
  quotesByPartRequestId,
  repairJobsById,
  serviceCategoriesById,
  vehiclesById,
  vendorsById,
}) {
  const repairJob = repairJobsById[part.repair_job_id] ?? null;
  const repairJobVehicle = vehiclesById[repairJob?.vehicle_id] ?? null;
  const vehicle = vehiclesById[part.vehicle_id] ?? repairJobVehicle ?? null;
  const vehicleContext = getVehicleContext(vehicle);
  const repairJobVehicleContext = getVehicleContext(repairJobVehicle);
  const purchaseOrderItems = (
    purchaseOrderItemsByPartRequestId[part.id] ?? []
  ).map((item) => {
    const purchaseOrder = purchaseOrdersById[item.purchase_order_id] ?? null;

    return {
      ...item,
      purchaseOrder: purchaseOrder
        ? {
            ...purchaseOrder,
            orderedByProfile: profilesById[purchaseOrder.ordered_by] ?? null,
            receivedByProfile: profilesById[purchaseOrder.received_by] ?? null,
            vendor: vendorsById[purchaseOrder.vendor_id] ?? null,
          }
        : null,
      returnedByProfile: profilesById[item.returned_by] ?? null,
    };
  });
  const quotes = [...(quotesByPartRequestId[part.id] ?? [])].sort(latestQuoteFirst);
  const latestQuote = quotes[0] ?? null;
  const selectedQuote = part.selected_quote_id
    ? quotesById[part.selected_quote_id] ?? null
    : null;

  const enrichedPart = {
    ...part,
    approvedByProfile: profilesById[part.approved_by] ?? null,
    createdByProfile: profilesById[part.created_by] ?? null,
    latestQuote,
    purchaseOrderItems,
    quotes,
    repairJob: repairJob
      ? {
          ...repairJob,
          serviceCategory:
            serviceCategoriesById[repairJob.service_category_id] ?? null,
          vehicle: repairJobVehicle,
          vehicleContext: repairJobVehicleContext,
          vehicleSearchText: getVehicleSearchText(repairJobVehicleContext),
          vehicleVin: repairJobVehicleContext?.vin ?? "",
        }
      : null,
    selectedQuote,
    selectedVendor:
      vendorsById[part.selected_vendor_id] ??
      vendorsById[selectedQuote?.vendor_id] ??
      null,
    vehicle_id: part.vehicle_id ?? repairJob?.vehicle_id ?? null,
    vehicle,
    vehicleContext,
    vehicleSearchText: getVehicleSearchText(vehicleContext),
    vehicleVin: vehicleContext?.vin ?? "",
  };

  return {
    ...enrichedPart,
    searchText: getPartQueueSearchText(enrichedPart),
  };
}

export async function fetchPartsQueue() {
  const partRequestsResponse = await supabase
    .from("part_requests")
    .select(partRequestColumns)
    .order("created_at", { ascending: false });

  if (partRequestsResponse.error) {
    return { data: null, error: partRequestsResponse.error };
  }

  const partRequests = partRequestsResponse.data ?? [];
  const partRequestIds = uniqueValues(partRequests.map((part) => part.id));
  const repairJobIds = uniqueValues(partRequests.map((part) => part.repair_job_id));
  const profileIds = uniqueValues(
    partRequests.flatMap((part) => [part.created_by, part.approved_by])
  );
  const selectedQuoteIds = uniqueValues(
    partRequests.map((part) => part.selected_quote_id)
  );

  const [
    vehiclesResponse,
    repairJobsResponse,
    profilesResponse,
    vendorsResponse,
    purchaseOrderItemsResponse,
    serviceCategoriesResponse,
    linkedVendorQuotesResponse,
    selectedVendorQuotesResponse,
  ] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, stock_number, vin, year, make, model, trim, color, color_hex, status"),
    repairJobIds.length > 0
      ? supabase
          .from("repair_jobs")
          .select(
            "id, vehicle_id, service_category_id, title, category, priority, status, created_at"
          )
          .in("id", repairJobIds)
      : { data: [], error: null },
    profileIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .in("id", profileIds)
      : { data: [], error: null },
    supabase.from("vendors").select("id, name, phone, email, vendor_type").order("name", {
      ascending: true,
    }),
    partRequestIds.length > 0
      ? supabase
          .from("purchase_order_items")
          .select(purchaseOrderItemColumns)
          .in("part_request_id", partRequestIds)
      : { data: [], error: null },
    supabase
      .from("service_categories")
      .select("id, slug, name, description, sort_order, is_active")
      .order("sort_order", { ascending: true }),
    partRequestIds.length > 0
      ? supabase
          .from("vendor_part_quotes")
          .select(vendorPartQuoteColumns)
          .in("part_request_id", partRequestIds)
          .order("quoted_at", { ascending: false })
      : { data: [], error: null },
    selectedQuoteIds.length > 0
      ? supabase
          .from("vendor_part_quotes")
          .select(vendorPartQuoteColumns)
          .in("id", selectedQuoteIds)
      : { data: [], error: null },
  ]);

  const firstRequiredError =
    vehiclesResponse.error ??
    repairJobsResponse.error ??
    profilesResponse.error ??
    vendorsResponse.error ??
    purchaseOrderItemsResponse.error ??
    serviceCategoriesResponse.error;

  if (firstRequiredError) {
    return { data: null, error: firstRequiredError };
  }

  if (linkedVendorQuotesResponse.error ?? selectedVendorQuotesResponse.error) {
    console.warn(
      "Parts queue loaded without vendor quote context:",
      linkedVendorQuotesResponse.error ?? selectedVendorQuotesResponse.error
    );
  }

  const purchaseOrderItems = purchaseOrderItemsResponse.data ?? [];
  const purchaseOrderIds = uniqueValues(
    purchaseOrderItems.map((item) => item.purchase_order_id)
  );

  const purchaseOrdersResponse =
    purchaseOrderIds.length > 0
      ? await supabase
          .from("purchase_orders")
          .select(purchaseOrderColumns)
          .in("id", purchaseOrderIds)
      : { data: [], error: null };

  if (purchaseOrdersResponse.error) {
    return { data: null, error: purchaseOrdersResponse.error };
  }

  const vendors = vendorsResponse.data ?? [];
  const vendorsById = Object.fromEntries(
    vendors.map((vendor) => [vendor.id, vendor])
  );
  let vehiclesById = Object.fromEntries(
    (vehiclesResponse.data ?? []).map((vehicle) => [vehicle.id, vehicle])
  );
  const repairJobsById = Object.fromEntries(
    (repairJobsResponse.data ?? []).map((repairJob) => [repairJob.id, repairJob])
  );
  const missingRepairJobVehicleIds = uniqueValues(
    (repairJobsResponse.data ?? [])
      .map((repairJob) => repairJob.vehicle_id)
      .filter((vehicleId) => vehicleId && !vehiclesById[vehicleId])
  );

  if (missingRepairJobVehicleIds.length > 0) {
    const missingVehiclesResponse = await supabase
      .from("vehicles")
      .select("id, stock_number, vin, year, make, model, trim, color, color_hex, status")
      .in("id", missingRepairJobVehicleIds);

    if (missingVehiclesResponse.error) {
      return { data: null, error: missingVehiclesResponse.error };
    }

    vehiclesById = {
      ...vehiclesById,
      ...Object.fromEntries(
        (missingVehiclesResponse.data ?? []).map((vehicle) => [
          vehicle.id,
          vehicle,
        ])
      ),
    };
  }
  const serviceCategoriesById = Object.fromEntries(
    (serviceCategoriesResponse.data ?? []).map((category) => [
      category.id,
      category,
    ])
  );
  const purchaseOrdersById = Object.fromEntries(
    (purchaseOrdersResponse.data ?? []).map((purchaseOrder) => [
      purchaseOrder.id,
      purchaseOrder,
    ])
  );
  const purchaseOrderItemsByPartRequestId = groupBy(
    purchaseOrderItems,
    "part_request_id"
  );
  const quoteRecordsById = new Map();
  const quoteRecords = [
    ...(linkedVendorQuotesResponse.error
      ? []
      : linkedVendorQuotesResponse.data ?? []),
    ...(selectedVendorQuotesResponse.error
      ? []
      : selectedVendorQuotesResponse.data ?? []),
  ].map((quote) => ({
    ...quote,
    display_vendor_name: getVendorQuoteDisplayName(quote),
  }));

  for (const quote of quoteRecords) {
    quoteRecordsById.set(quote.id, quote);
  }

  const allQuoteRecords = [...quoteRecordsById.values()];
  const knownProfileIds = new Set(
    (profilesResponse.data ?? []).map((profile) => profile.id)
  );
  const additionalProfileIds = uniqueValues([
    ...purchaseOrderItems.map((item) => item.returned_by),
    ...(purchaseOrdersResponse.data ?? []).flatMap((purchaseOrder) => [
      purchaseOrder.ordered_by,
      purchaseOrder.received_by,
    ]),
    ...allQuoteRecords.map((quote) => quote.created_by),
  ]).filter((profileId) => !knownProfileIds.has(profileId));
  const additionalProfilesResponse =
    additionalProfileIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .in("id", additionalProfileIds)
      : { data: [], error: null };

  if (additionalProfilesResponse.error) {
    return { data: null, error: additionalProfilesResponse.error };
  }

  const profilesById = Object.fromEntries(
    [
      ...(profilesResponse.data ?? []),
      ...(additionalProfilesResponse.data ?? []),
    ].map((profile) => [profile.id, profile])
  );
  const quoteRecordsWithProfiles = allQuoteRecords.map((quote) => ({
    ...quote,
    createdByProfile: profilesById[quote.created_by] ?? null,
  }));
  const quotesById = Object.fromEntries(
    quoteRecordsWithProfiles.map((quote) => [quote.id, quote])
  );
  const quotesByPartRequestId = groupBy(
    quoteRecordsWithProfiles.filter((quote) =>
      partRequestIds.includes(quote.part_request_id)
    ),
    "part_request_id"
  );
  const parts = partRequests.map((part) =>
    enrichPart({
      part,
      profilesById,
      purchaseOrderItemsByPartRequestId,
      purchaseOrdersById,
      quotesById,
      quotesByPartRequestId,
      repairJobsById,
      serviceCategoriesById,
      vehiclesById,
      vendorsById,
    })
  );

  return {
    data: {
      counts: getPartQueueCounts(parts),
      parts,
      serviceCategories: serviceCategoriesResponse.data ?? [],
      vehicleSearchIndex: buildVehicleSearchIndex(vehiclesResponse.data ?? []),
      vendors,
    },
    error: null,
  };
}

export function filterPartsQueueResults(parts, filters) {
  return filterPartsQueue(parts, filters);
}

function numberOrDefault(value, fallback = 0) {
  const numberValue = Number(value ?? fallback);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

async function loadQuoteForSelection(quoteId) {
  const { data, error } = await supabase
    .from("vendor_part_quotes")
    .select(
      "id, vendor_id, vendor_name_snapshot, raw_part_name, normalized_part_name, unit_price, total_price, quote_status, availability"
    )
    .eq("id", quoteId)
    .single();

  if (error) {
    console.error("Failed to load vendor quote for selection", error);
    return { data: null, error };
  }

  return { data, error: null };
}

export async function selectQuoteForPartRequest({
  partRequestId,
  quantity = 1,
  quote,
} = {}) {
  if (!partRequestId) {
    throw new Error("Missing part request id");
  }

  if (!quote?.id) {
    throw new Error("Missing quote id");
  }

  let selectedQuote = quote;

  if (!selectedQuote.vendor_id) {
    const quoteResponse = await loadQuoteForSelection(selectedQuote.id);

    if (quoteResponse.error) {
      throw new Error("Could not select this vendor price. Please try again.");
    }

    selectedQuote = {
      ...selectedQuote,
      ...(quoteResponse.data ?? {}),
    };
  }

  if (!selectedQuote.vendor_id) {
    throw new Error("This quote has no linked vendor, so it cannot be used for PO.");
  }

  const partQuantity = Math.max(numberOrDefault(quantity, 1), 1);
  const unitPrice = numberOrDefault(selectedQuote.unit_price, NaN);

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error("This vendor quote is missing a valid price.");
  }

  const quoteTotal = numberOrDefault(selectedQuote.total_price, NaN);
  const calculatedTotal = Number.isFinite(quoteTotal)
    ? quoteTotal
    : unitPrice * partQuantity;
  const updatePayload = {
    quoted_total_cost: calculatedTotal,
    quoted_unit_cost: unitPrice,
    selected_quote_id: selectedQuote.id,
    selected_vendor_id: selectedQuote.vendor_id,
  };

  try {
    const { data, error } = await supabase
      .from("part_requests")
      .update(updatePayload)
      .eq("id", partRequestId)
      .select(
        "id, part_name, selected_vendor_id, selected_quote_id, quoted_unit_cost, quoted_total_cost"
      )
      .single();

    if (error) {
      console.error("Failed to select vendor quote", error);
      throw new Error("Could not select this vendor price. Please try again.");
    }

    if (
      !data?.selected_vendor_id ||
      !data?.selected_quote_id ||
      data.selected_quote_id !== selectedQuote.id ||
      data.selected_vendor_id !== selectedQuote.vendor_id ||
      data.quoted_unit_cost === null ||
      data.quoted_unit_cost === undefined
    ) {
      console.error("Quote selection did not persist", data);
      throw new Error("Quote selection did not persist");
    }

    return data;
  } catch (error) {
    console.error("Failed to select vendor quote", error);

    if (
      error.message === "Quote selection did not persist" ||
      error.message === "This quote has no linked vendor, so it cannot be used for PO." ||
      error.message === "Missing part request id" ||
      error.message === "Missing quote id"
    ) {
      throw error;
    }

    throw new Error("Could not select this vendor price. Please try again.", {
      cause: error,
    });
  }
}
