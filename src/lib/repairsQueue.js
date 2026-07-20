import {
  filterRepairsQueue,
  getRepairQueueCounts,
} from "./repairWorkflowUtils";
import { purchaseOrderItemReturnColumns } from "./partReturns";
import { supabase } from "./supabaseClient";

const repairJobColumns =
  "id, vehicle_id, service_category_id, title, category, priority, status, assigned_to, created_by, notes, created_at, completed_at";

const partRequestColumns =
  "id, vehicle_id, repair_job_id, part_name, quantity, status, notes, part_source, approval_status, unit_cost, selected_vendor_id, selected_quote_id, quoted_unit_cost, quoted_total_cost, created_by, created_at";

const laborLogColumns =
  "id, vehicle_id, repair_job_id, technician_id, hours, hourly_rate, labor_cost, notes, created_at";

const vehiclePhotoColumns =
  "id, vehicle_id, repair_job_id, photo_url, photo_path, caption, photo_type, created_at";

const thirdPartyRepairColumns =
  "id, vehicle_id, repair_job_id, vendor_id, service_rendered, status, repair_cost, transit_cost, notes, created_at";

const purchaseOrderItemColumns =
  `id, purchase_order_id, part_request_id, description, quantity, unit_cost, shipping_cost, tax, status, notes, created_at, ${purchaseOrderItemReturnColumns}`;

const purchaseOrderColumns =
  "id, vehicle_id, vendor_id, status, ordered_at, received_at, created_at";

const vendorQuoteColumns =
  "id, vendor_id, vendor_name_snapshot, unit_price, total_price, quote_status, availability";

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function groupBy(records, key) {
  return records.reduce((groupedRecords, record) => {
    const groupKey = record?.[key];

    if (!groupKey) {
      return groupedRecords;
    }

    groupedRecords[groupKey] = [...(groupedRecords[groupKey] ?? []), record];
    return groupedRecords;
  }, {});
}

function enrichParts({
  partRequests,
  purchaseOrderItemsByPartRequestId,
  purchaseOrdersById,
  selectedQuotesById,
  vendorsById,
}) {
  return partRequests.map((part) => {
    const purchaseOrderItems = (
      purchaseOrderItemsByPartRequestId[part.id] ?? []
    ).map((item) => {
      const purchaseOrder = purchaseOrdersById[item.purchase_order_id] ?? null;

      return {
        ...item,
        purchaseOrder: purchaseOrder
          ? {
              ...purchaseOrder,
              vendor: vendorsById[purchaseOrder.vendor_id] ?? null,
            }
          : null,
      };
    });
    const selectedQuote = part.selected_quote_id
      ? selectedQuotesById[part.selected_quote_id] ?? null
      : null;

    return {
      ...part,
      purchaseOrderItems,
      selectedQuote,
      selectedVendor:
        vendorsById[part.selected_vendor_id] ??
        vendorsById[selectedQuote?.vendor_id] ??
        null,
    };
  });
}

export async function fetchRepairsQueue({ canViewTeamRates = false } = {}) {
  const profileColumns = canViewTeamRates
    ? "id, full_name, email, role, phone, hourly_rate"
    : "id, full_name, email, role";
  const profileSource = canViewTeamRates ? "profiles" : "profile_display_names";
  const repairJobsResponse = await supabase
    .from("repair_jobs")
    .select(repairJobColumns)
    .order("created_at", { ascending: false });

  if (repairJobsResponse.error) {
    return { data: null, error: repairJobsResponse.error };
  }

  const repairJobs = repairJobsResponse.data ?? [];
  const repairJobIds = uniqueValues(repairJobs.map((job) => job.id));
  const vehicleIds = uniqueValues(repairJobs.map((job) => job.vehicle_id));
  const [
    vehiclesResponse,
    serviceCategoriesResponse,
    profilesResponse,
    vendorsResponse,
    partRequestsResponse,
    laborLogsResponse,
    vehiclePhotosResponse,
    thirdPartyRepairsResponse,
  ] = await Promise.all([
    vehicleIds.length > 0
      ? supabase
          .from("vehicles")
          .select(
            "id, stock_number, vin, year, make, model, trim, color, color_hex, status"
          )
          .in("id", vehicleIds)
      : { data: [], error: null },
    supabase
      .from("service_categories")
      .select("id, slug, name, is_active, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from(profileSource)
      .select(profileColumns),
    supabase.from("vendors").select("id, name, phone, email, vendor_type").order("name", {
      ascending: true,
    }),
    repairJobIds.length > 0
      ? supabase
          .from("part_requests")
          .select(partRequestColumns)
          .in("repair_job_id", repairJobIds)
      : { data: [], error: null },
    repairJobIds.length > 0
      ? supabase
          .from("labor_logs")
          .select(laborLogColumns)
          .in("repair_job_id", repairJobIds)
      : { data: [], error: null },
    repairJobIds.length > 0
      ? supabase
          .from("vehicle_photos")
          .select(vehiclePhotoColumns)
          .in("repair_job_id", repairJobIds)
      : { data: [], error: null },
    repairJobIds.length > 0
      ? supabase
          .from("third_party_repairs")
          .select(thirdPartyRepairColumns)
          .in("repair_job_id", repairJobIds)
      : { data: [], error: null },
  ]);

  const firstError =
    vehiclesResponse.error ??
    serviceCategoriesResponse.error ??
    profilesResponse.error ??
    vendorsResponse.error ??
    partRequestsResponse.error ??
    laborLogsResponse.error ??
    vehiclePhotosResponse.error ??
    thirdPartyRepairsResponse.error;

  if (firstError) {
    return { data: null, error: firstError };
  }

  const partRequests = partRequestsResponse.data ?? [];
  const partRequestIds = uniqueValues(partRequests.map((part) => part.id));
  const selectedQuoteIds = uniqueValues(
    partRequests.map((part) => part.selected_quote_id)
  );

  const [purchaseOrderItemsResponse, selectedQuotesResponse] = await Promise.all([
    partRequestIds.length > 0
      ? supabase
          .from("purchase_order_items")
          .select(purchaseOrderItemColumns)
          .in("part_request_id", partRequestIds)
      : { data: [], error: null },
    selectedQuoteIds.length > 0
      ? supabase
          .from("vendor_part_quotes")
          .select(vendorQuoteColumns)
          .in("id", selectedQuoteIds)
      : { data: [], error: null },
  ]);

  const secondError =
    purchaseOrderItemsResponse.error ?? selectedQuotesResponse.error;

  if (secondError) {
    return { data: null, error: secondError };
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

  const vehiclesById = Object.fromEntries(
    (vehiclesResponse.data ?? []).map((vehicle) => [vehicle.id, vehicle])
  );
  const serviceCategoriesById = Object.fromEntries(
    (serviceCategoriesResponse.data ?? []).map((category) => [
      category.id,
      category,
    ])
  );
  const profilesById = Object.fromEntries(
    (profilesResponse.data ?? []).map((profile) => [profile.id, profile])
  );
  const vendorsById = Object.fromEntries(
    (vendorsResponse.data ?? []).map((vendor) => [vendor.id, vendor])
  );
  const purchaseOrdersById = Object.fromEntries(
    (purchaseOrdersResponse.data ?? []).map((purchaseOrder) => [
      purchaseOrder.id,
      purchaseOrder,
    ])
  );
  const selectedQuotesById = Object.fromEntries(
    (selectedQuotesResponse.data ?? []).map((quote) => [quote.id, quote])
  );
  const enrichedParts = enrichParts({
    partRequests,
    purchaseOrderItemsByPartRequestId: groupBy(
      purchaseOrderItems,
      "part_request_id"
    ),
    purchaseOrdersById,
    selectedQuotesById,
    vendorsById,
  });
  const partsByRepairJobId = groupBy(enrichedParts, "repair_job_id");
  const laborLogsByRepairJobId = groupBy(laborLogsResponse.data ?? [], "repair_job_id");
  const photosByRepairJobId = groupBy(vehiclePhotosResponse.data ?? [], "repair_job_id");
  const thirdPartyRepairsByRepairJobId = groupBy(
    thirdPartyRepairsResponse.data ?? [],
    "repair_job_id"
  );

  const jobs = repairJobs.map((job) => {
    const serviceCategory = job.service_category_id
      ? serviceCategoriesById[job.service_category_id] ?? null
      : null;

    return {
      ...job,
      assignedProfile: profilesById[job.assigned_to] ?? null,
      createdByProfile: profilesById[job.created_by] ?? null,
      laborLogs: laborLogsByRepairJobId[job.id] ?? [],
      parts: partsByRepairJobId[job.id] ?? [],
      photos: photosByRepairJobId[job.id] ?? [],
      serviceCategory,
      thirdPartyRepairs: (thirdPartyRepairsByRepairJobId[job.id] ?? []).map(
        (repair) => ({
          ...repair,
          vendor: vendorsById[repair.vendor_id] ?? null,
        })
      ),
      vehicle: vehiclesById[job.vehicle_id] ?? null,
    };
  });

  return {
    data: {
      counts: getRepairQueueCounts(jobs),
      jobs,
      profiles: profilesResponse.data ?? [],
      serviceCategories: serviceCategoriesResponse.data ?? [],
      vendors: vendorsResponse.data ?? [],
    },
    error: null,
  };
}

export function filterRepairsQueueResults(jobs, filters) {
  return filterRepairsQueue(jobs, filters);
}
