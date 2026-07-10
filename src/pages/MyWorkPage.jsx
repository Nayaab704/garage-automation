import { useEffect, useMemo, useState } from "react";
import VehicleStatusBadge from "../components/VehicleStatusBadge";
import AppIcon from "../components/ui/AppIcon";
import StatusBadge from "../components/ui/StatusBadge";
import { supabase } from "../lib/supabaseClient";
import { formatUserFirstName } from "../lib/userDisplay";
import { getWorkOrderStatusLabel } from "../lib/workOrderStatus";

const repairJobColumns =
  "id, vehicle_id, service_category_id, title, category, priority, status, assigned_to, created_by, notes, created_at, completed_at";

const laborLogColumns =
  "id, vehicle_id, repair_job_id, technician_id, hours, hourly_rate, notes, created_at";

const partRequestColumns =
  "id, vehicle_id, repair_job_id, part_name, quantity, status, notes, part_source, approval_status, selected_vendor_id, created_by, created_at";

const thirdPartyRepairColumns =
  "id, vehicle_id, repair_job_id, vendor_id, service_rendered, status, outbound_date, inbound_date, notes, created_by, created_at";

const vehicleDocumentColumns =
  "id, vehicle_id, repair_job_id, third_party_repair_id, purchase_order_id, document_type, file_name, notes, uploaded_by, created_at";

const purchaseOrderColumns =
  "id, vehicle_id, vendor_id, status, ordered_by, ordered_at, received_by, received_at, notes, created_at";

const purchaseOrderItemColumns =
  "id, purchase_order_id, part_request_id, description, quantity, status, created_at, return_status, returned_at, returned_by";

const vehicleColumns =
  "id, stock_number, vin, year, make, model, trim, color, color_hex, status";

const terminalWorkOrderStatuses = new Set([
  "archived",
  "cancelled",
  "canceled",
  "completed",
]);

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const INITIAL_ACTIVE_WORK_ORDER_COUNT = 3;
const INITIAL_TODAY_ACTIVITY_COUNT = 5;
const INITIAL_RECENT_VEHICLE_COUNT = 6;

const mobileSectionTabs = [
  { key: "active", label: "Active" },
  { key: "activity", label: "Activity" },
  { key: "vehicles", label: "Vehicles" },
];

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function makeMap(records) {
  return Object.fromEntries(
    (records ?? [])
      .filter((record) => record?.id)
      .map((record) => [record.id, record])
  );
}

function mergeRecordsById(...recordGroups) {
  const recordsById = new Map();

  for (const records of recordGroups) {
    for (const record of records ?? []) {
      if (record?.id) {
        recordsById.set(record.id, record);
      }
    }
  }

  return [...recordsById.values()];
}

function groupBy(records, key) {
  return (records ?? []).reduce((groupedRecords, record) => {
    const groupKey = record?.[key];

    if (!groupKey) {
      return groupedRecords;
    }

    groupedRecords[groupKey] = [...(groupedRecords[groupKey] ?? []), record];
    return groupedRecords;
  }, {});
}

function getDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getStartOfToday(referenceDate = new Date()) {
  const date = new Date(referenceDate);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getStartOfWeek(referenceDate = new Date()) {
  const date = getStartOfToday(referenceDate);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function isToday(value, referenceDate = new Date()) {
  const date = getDate(value);

  if (!date) {
    return false;
  }

  return date >= getStartOfToday(referenceDate);
}

function isOnOrAfter(value, startDate) {
  const date = getDate(value);

  return Boolean(date && date >= startDate);
}

function getLatestDate(...values) {
  return values
    .map(getDate)
    .filter(Boolean)
    .sort((firstDate, secondDate) => secondDate - firstDate)[0];
}

function formatDateTime(value) {
  const date = getDate(value);

  if (!date) {
    return "Not available";
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatRelativeDate(value) {
  const date = getDate(value);

  if (!date) {
    return "Not available";
  }

  const today = getStartOfToday();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date >= today) {
    return "Today";
  }

  if (date >= yesterday) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatHours(value) {
  const numberValue = Number(value ?? 0);
  const safeValue = Number.isFinite(numberValue) ? numberValue : 0;

  return `${numberFormatter.format(safeValue)}h`;
}

function displayValue(value, fallback = "Not available") {
  const cleanValue = String(value ?? "").trim();

  return cleanValue || fallback;
}

function getWorkOrderTitle(workOrder) {
  return displayValue(workOrder?.title, "Untitled Work Order");
}

function getVehicleName(vehicle) {
  return (
    [
      vehicle?.year,
      vehicle?.make,
      vehicle?.model,
      vehicle?.trim,
    ]
      .filter(Boolean)
      .join(" ") || "Vehicle"
  );
}

function getVehicleLine(vehicle) {
  if (!vehicle) {
    return "Vehicle not available";
  }

  return [vehicle.stock_number, getVehicleName(vehicle)]
    .filter(Boolean)
    .join(" - ");
}

function normalizeStatus(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isActiveWorkOrder(workOrder) {
  const status = normalizeStatus(workOrder?.status);

  if (terminalWorkOrderStatuses.has(status)) {
    return false;
  }

  return !workOrder?.completed_at;
}

function getCategoryLabel(workOrder, serviceCategoriesById) {
  const serviceCategory = workOrder?.service_category_id
    ? serviceCategoriesById[workOrder.service_category_id]
    : null;

  const categoryLabel = String(workOrder?.category ?? "")
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return serviceCategory?.name ?? displayValue(categoryLabel, "Service Work");
}

function getDocumentTypeLabel(documentType) {
  return String(documentType ?? "document")
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getFirstError(...responses) {
  return responses.find((response) => response?.error)?.error ?? null;
}

async function fetchRecordsByIds(tableName, selectColumns, ids) {
  const recordIds = uniqueValues(ids);

  if (recordIds.length === 0) {
    return { data: [], error: null };
  }

  return supabase.from(tableName).select(selectColumns).in("id", recordIds);
}

async function fetchMyWorkData(currentProfile) {
  if (!currentProfile?.id) {
    return { data: null, error: new Error("Missing user profile.") };
  }

  const profileId = currentProfile.id;
  const activityUserIds = uniqueValues([
    currentProfile.id,
    currentProfile.auth_user_id,
  ]);

  const [
    directRepairJobsResponse,
    laborLogsResponse,
    partRequestsResponse,
    thirdPartyRepairsResponse,
    vehicleDocumentsResponse,
    purchaseOrdersResponse,
    returnedItemsResponse,
    activityLogsResponse,
    serviceCategoriesResponse,
  ] = await Promise.all([
    supabase
      .from("repair_jobs")
      .select(repairJobColumns)
      .or(`created_by.eq.${profileId},assigned_to.eq.${profileId}`)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("labor_logs")
      .select(laborLogColumns)
      .eq("technician_id", profileId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("part_requests")
      .select(partRequestColumns)
      .eq("created_by", profileId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("third_party_repairs")
      .select(thirdPartyRepairColumns)
      .eq("created_by", profileId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("vehicle_documents")
      .select(vehicleDocumentColumns)
      .eq("uploaded_by", profileId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("purchase_orders")
      .select(purchaseOrderColumns)
      .or(`ordered_by.eq.${profileId},received_by.eq.${profileId}`)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("purchase_order_items")
      .select(purchaseOrderItemColumns)
      .eq("returned_by", profileId)
      .order("returned_at", { ascending: false })
      .limit(200),
    activityUserIds.length > 0
      ? supabase
          .from("activity_logs")
          .select("id, vehicle_id, user_id, action, details, created_at")
          .in("user_id", activityUserIds)
          .order("created_at", { ascending: false })
          .limit(100)
      : { data: [], error: null },
    supabase
      .from("service_categories")
      .select("id, slug, name, sort_order, is_active")
      .order("sort_order", { ascending: true }),
  ]);

  const firstError = getFirstError(
    directRepairJobsResponse,
    laborLogsResponse,
    partRequestsResponse,
    thirdPartyRepairsResponse,
    vehicleDocumentsResponse,
    purchaseOrdersResponse,
    returnedItemsResponse,
    activityLogsResponse,
    serviceCategoriesResponse
  );

  if (firstError) {
    return { data: null, error: firstError };
  }

  const purchaseOrders = purchaseOrdersResponse.data ?? [];
  const returnedItems = returnedItemsResponse.data ?? [];
  const laborLogs = laborLogsResponse.data ?? [];
  const thirdPartyRepairs = thirdPartyRepairsResponse.data ?? [];
  const vehicleDocuments = vehicleDocumentsResponse.data ?? [];
  const activityLogs = activityLogsResponse.data ?? [];
  const purchaseOrderIds = uniqueValues([
    ...purchaseOrders.map((purchaseOrder) => purchaseOrder.id),
    ...returnedItems.map((item) => item.purchase_order_id),
  ]);
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

  const purchaseOrderItems = mergeRecordsById(
    purchaseOrderItemsResponse.data ?? [],
    returnedItems
  );
  const linkedPartRequestIds = uniqueValues(
    purchaseOrderItems.map((item) => item.part_request_id)
  );
  const linkedPartRequestsResponse = await fetchRecordsByIds(
    "part_requests",
    partRequestColumns,
    linkedPartRequestIds
  );

  if (linkedPartRequestsResponse.error) {
    return { data: null, error: linkedPartRequestsResponse.error };
  }

  const partRequests = mergeRecordsById(
    partRequestsResponse.data ?? [],
    linkedPartRequestsResponse.data ?? []
  );
  const directRepairJobs = directRepairJobsResponse.data ?? [];
  const knownRepairJobIds = new Set(
    directRepairJobs.map((workOrder) => workOrder.id)
  );
  const linkedRepairJobIds = uniqueValues([
    ...laborLogs.map((laborLog) => laborLog.repair_job_id),
    ...partRequests.map((partRequest) => partRequest.repair_job_id),
    ...thirdPartyRepairs.map((repair) => repair.repair_job_id),
    ...vehicleDocuments.map((documentRecord) => documentRecord.repair_job_id),
  ]);
  const missingRepairJobIds = linkedRepairJobIds.filter(
    (repairJobId) => !knownRepairJobIds.has(repairJobId)
  );
  const linkedRepairJobsResponse = await fetchRecordsByIds(
    "repair_jobs",
    repairJobColumns,
    missingRepairJobIds
  );

  if (linkedRepairJobsResponse.error) {
    return { data: null, error: linkedRepairJobsResponse.error };
  }

  const repairJobs = mergeRecordsById(
    directRepairJobs,
    linkedRepairJobsResponse.data ?? []
  );
  const purchaseOrdersById = makeMap(purchaseOrders);
  const partRequestsById = makeMap(partRequests);
  const vehicleIds = uniqueValues([
    ...repairJobs.map((workOrder) => workOrder.vehicle_id),
    ...laborLogs.map((laborLog) => laborLog.vehicle_id),
    ...partRequests.map((partRequest) => partRequest.vehicle_id),
    ...thirdPartyRepairs.map((repair) => repair.vehicle_id),
    ...vehicleDocuments.map((documentRecord) => documentRecord.vehicle_id),
    ...purchaseOrders.map((purchaseOrder) => purchaseOrder.vehicle_id),
    ...returnedItems.map((item) => {
      const partRequest = partRequestsById[item.part_request_id];
      const purchaseOrder = purchaseOrdersById[item.purchase_order_id];

      return partRequest?.vehicle_id ?? purchaseOrder?.vehicle_id;
    }),
    ...activityLogs.map((activity) => activity.vehicle_id),
  ]);
  const vehiclesResponse = await fetchRecordsByIds(
    "vehicles",
    vehicleColumns,
    vehicleIds
  );

  if (vehiclesResponse.error) {
    return { data: null, error: vehiclesResponse.error };
  }

  return {
    data: {
      activityLogs,
      laborLogs,
      partRequests,
      purchaseOrderItems,
      purchaseOrders,
      repairJobs,
      returnedItems,
      serviceCategories: serviceCategoriesResponse.data ?? [],
      thirdPartyRepairs,
      vehicleDocuments,
      vehicles: vehiclesResponse.data ?? [],
    },
    error: null,
  };
}

function buildMyWorkViewModel(records, currentProfile) {
  const referenceDate = new Date();
  const startOfWeek = getStartOfWeek(referenceDate);
  const vehiclesById = makeMap(records.vehicles);
  const repairJobsById = makeMap(records.repairJobs);
  const partRequestsById = makeMap(records.partRequests);
  const serviceCategoriesById = makeMap(records.serviceCategories);
  const purchaseOrdersById = makeMap(records.purchaseOrders);
  const purchaseOrderItemsByPurchaseOrderId = groupBy(
    records.purchaseOrderItems,
    "purchase_order_id"
  );
  const workOrderInvolvementById = new Map();
  const vehicleTouchById = new Map();
  const profileId = currentProfile?.id;

  function markWorkOrder(repairJobId, dateValue, updates = {}) {
    if (!repairJobId) {
      return;
    }

    const currentValue = workOrderInvolvementById.get(repairJobId) ?? {
      laborHours: 0,
      lastActivityAt: null,
    };
    const latestDate = getLatestDate(currentValue.lastActivityAt, dateValue);

    workOrderInvolvementById.set(repairJobId, {
      ...currentValue,
      ...updates,
      laborHours:
        currentValue.laborHours + Number(updates.laborHoursToAdd ?? 0),
      lastActivityAt: latestDate?.toISOString() ?? currentValue.lastActivityAt,
    });
  }

  function markVehicle(vehicleId, dateValue, action = "Activity") {
    if (!vehicleId) {
      return;
    }

    const currentValue = vehicleTouchById.get(vehicleId) ?? {
      actionCount: 0,
      lastAction: action,
      lastActivityAt: null,
    };
    const latestDate = getLatestDate(currentValue.lastActivityAt, dateValue);
    const isLatestAction = latestDate && getDate(dateValue)?.getTime() === latestDate.getTime();

    vehicleTouchById.set(vehicleId, {
      actionCount: currentValue.actionCount + 1,
      lastAction: isLatestAction ? action : currentValue.lastAction,
      lastActivityAt: latestDate?.toISOString() ?? currentValue.lastActivityAt,
    });
  }

  function getWorkOrderForPartRequest(partRequest) {
    return partRequest?.repair_job_id
      ? repairJobsById[partRequest.repair_job_id] ?? null
      : null;
  }

  function getPurchaseOrderWorkOrder(purchaseOrder) {
    const items = purchaseOrderItemsByPurchaseOrderId[purchaseOrder?.id] ?? [];
    const linkedPartRequest = items
      .map((item) => partRequestsById[item.part_request_id])
      .find(Boolean);

    return getWorkOrderForPartRequest(linkedPartRequest);
  }

  function getReturnedItemVehicleId(item) {
    return (
      partRequestsById[item?.part_request_id]?.vehicle_id ??
      purchaseOrdersById[item?.purchase_order_id]?.vehicle_id ??
      null
    );
  }

  for (const workOrder of records.repairJobs) {
    if (workOrder.created_by === profileId || workOrder.assigned_to === profileId) {
      markWorkOrder(workOrder.id, workOrder.created_at);
      markVehicle(workOrder.vehicle_id, workOrder.created_at, "Work order");
    }
  }

  for (const laborLog of records.laborLogs) {
    markWorkOrder(laborLog.repair_job_id, laborLog.created_at, {
      laborHoursToAdd: Number(laborLog.hours || 0),
    });
    markVehicle(laborLog.vehicle_id, laborLog.created_at, "Labor");
  }

  for (const partRequest of records.partRequests) {
    if (partRequest.created_by === profileId) {
      markWorkOrder(partRequest.repair_job_id, partRequest.created_at);
      markVehicle(partRequest.vehicle_id, partRequest.created_at, "Part request");
    }
  }

  for (const repair of records.thirdPartyRepairs) {
    markWorkOrder(repair.repair_job_id, repair.created_at);
    markVehicle(repair.vehicle_id, repair.created_at, "Third-party repair");
  }

  for (const documentRecord of records.vehicleDocuments) {
    markWorkOrder(documentRecord.repair_job_id, documentRecord.created_at);
    markVehicle(documentRecord.vehicle_id, documentRecord.created_at, "Document");
  }

  for (const purchaseOrder of records.purchaseOrders) {
    const workOrder = getPurchaseOrderWorkOrder(purchaseOrder);

    if (purchaseOrder.ordered_by === profileId) {
      markWorkOrder(workOrder?.id, purchaseOrder.ordered_at ?? purchaseOrder.created_at);
      markVehicle(purchaseOrder.vehicle_id, purchaseOrder.ordered_at ?? purchaseOrder.created_at, "Purchase order");
    }

    if (purchaseOrder.received_by === profileId) {
      markWorkOrder(workOrder?.id, purchaseOrder.received_at ?? purchaseOrder.created_at);
      markVehicle(purchaseOrder.vehicle_id, purchaseOrder.received_at ?? purchaseOrder.created_at, "Received PO");
    }
  }

  for (const item of records.returnedItems) {
    const partRequest = partRequestsById[item.part_request_id];
    const vehicleId = getReturnedItemVehicleId(item);

    markWorkOrder(partRequest?.repair_job_id, item.returned_at ?? item.created_at);
    markVehicle(vehicleId, item.returned_at ?? item.created_at, "Returned part");
  }

  for (const activity of records.activityLogs) {
    const details = activity.details && typeof activity.details === "object"
      ? activity.details
      : {};
    const repairJobId = details.repair_job_id ?? details.repairJobId;

    markWorkOrder(repairJobId, activity.created_at);
    markVehicle(activity.vehicle_id, activity.created_at, activity.action);
  }

  const activeWorkOrders = records.repairJobs
    .filter((workOrder) => workOrderInvolvementById.has(workOrder.id))
    .filter(isActiveWorkOrder)
    .map((workOrder) => ({
      ...workOrder,
      involvement: workOrderInvolvementById.get(workOrder.id),
      serviceCategory: workOrder.service_category_id
        ? serviceCategoriesById[workOrder.service_category_id] ?? null
        : null,
      vehicle: vehiclesById[workOrder.vehicle_id] ?? null,
    }))
    .sort((firstWorkOrder, secondWorkOrder) => {
      const firstDate = getDate(firstWorkOrder.involvement.lastActivityAt);
      const secondDate = getDate(secondWorkOrder.involvement.lastActivityAt);

      return (secondDate?.getTime() ?? 0) - (firstDate?.getTime() ?? 0);
    });

  const todayActivities = [
    ...records.repairJobs
      .filter((workOrder) => workOrder.created_by === profileId)
      .filter((workOrder) => isToday(workOrder.created_at, referenceDate))
      .map((workOrder) => ({
        action: `Created work order: ${getWorkOrderTitle(workOrder)}`,
        date: workOrder.created_at,
        id: `work-order-${workOrder.id}`,
        repairJob: workOrder,
        vehicle: vehiclesById[workOrder.vehicle_id] ?? null,
      })),
    ...records.laborLogs
      .filter((laborLog) => isToday(laborLog.created_at, referenceDate))
      .map((laborLog) => {
        const repairJob = repairJobsById[laborLog.repair_job_id] ?? null;

        return {
          action: `Logged ${formatHours(laborLog.hours)} labor on ${getWorkOrderTitle(repairJob)}`,
          date: laborLog.created_at,
          id: `labor-${laborLog.id}`,
          repairJob,
          vehicle: vehiclesById[laborLog.vehicle_id] ?? null,
        };
      }),
    ...records.partRequests
      .filter((partRequest) => partRequest.created_by === profileId)
      .filter((partRequest) => isToday(partRequest.created_at, referenceDate))
      .map((partRequest) => ({
        action: `Requested part: ${displayValue(partRequest.part_name, "Unnamed part")}`,
        date: partRequest.created_at,
        id: `part-${partRequest.id}`,
        repairJob: repairJobsById[partRequest.repair_job_id] ?? null,
        vehicle: vehiclesById[partRequest.vehicle_id] ?? null,
      })),
    ...records.thirdPartyRepairs
      .filter((repair) => isToday(repair.created_at, referenceDate))
      .map((repair) => ({
        action: `Added third-party repair: ${displayValue(repair.service_rendered, "Service")}`,
        date: repair.created_at,
        id: `third-party-${repair.id}`,
        repairJob: repairJobsById[repair.repair_job_id] ?? null,
        vehicle: vehiclesById[repair.vehicle_id] ?? null,
      })),
    ...records.vehicleDocuments
      .filter((documentRecord) => isToday(documentRecord.created_at, referenceDate))
      .map((documentRecord) => ({
        action: `Uploaded ${getDocumentTypeLabel(documentRecord.document_type)} document`,
        date: documentRecord.created_at,
        id: `document-${documentRecord.id}`,
        repairJob: repairJobsById[documentRecord.repair_job_id] ?? null,
        vehicle: vehiclesById[documentRecord.vehicle_id] ?? null,
      })),
    ...records.purchaseOrders.flatMap((purchaseOrder) => {
      const events = [];
      const repairJob = getPurchaseOrderWorkOrder(purchaseOrder);
      const vehicle = vehiclesById[purchaseOrder.vehicle_id] ?? null;

      if (
        purchaseOrder.ordered_by === profileId &&
        isToday(purchaseOrder.ordered_at ?? purchaseOrder.created_at, referenceDate)
      ) {
        events.push({
          action: "Created purchase order",
          date: purchaseOrder.ordered_at ?? purchaseOrder.created_at,
          id: `purchase-order-${purchaseOrder.id}-ordered`,
          repairJob,
          vehicle,
        });
      }

      if (
        purchaseOrder.received_by === profileId &&
        isToday(purchaseOrder.received_at, referenceDate)
      ) {
        events.push({
          action: "Marked PO received",
          date: purchaseOrder.received_at,
          id: `purchase-order-${purchaseOrder.id}-received`,
          repairJob,
          vehicle,
        });
      }

      return events;
    }),
    ...records.returnedItems
      .filter((item) => isToday(item.returned_at, referenceDate))
      .map((item) => {
        const partRequest = partRequestsById[item.part_request_id];

        return {
          action: `Marked part returned: ${displayValue(item.description, "Part")}`,
          date: item.returned_at,
          id: `returned-${item.id}`,
          repairJob: partRequest?.repair_job_id
            ? repairJobsById[partRequest.repair_job_id] ?? null
            : null,
          vehicle: vehiclesById[getReturnedItemVehicleId(item)] ?? null,
        };
      }),
    ...records.activityLogs
      .filter((activity) => isToday(activity.created_at, referenceDate))
      .map((activity) => ({
        action: displayValue(activity.action, "Activity logged"),
        date: activity.created_at,
        id: `activity-${activity.id}`,
        repairJob: null,
        vehicle: vehiclesById[activity.vehicle_id] ?? null,
      })),
  ].sort((firstActivity, secondActivity) => {
    const firstDate = getDate(firstActivity.date);
    const secondDate = getDate(secondActivity.date);

    return (secondDate?.getTime() ?? 0) - (firstDate?.getTime() ?? 0);
  });

  const todayLaborHours = records.laborLogs
    .filter((laborLog) => isToday(laborLog.created_at, referenceDate))
    .reduce((total, laborLog) => total + Number(laborLog.hours || 0), 0);
  const weekLaborHours = records.laborLogs
    .filter((laborLog) => isOnOrAfter(laborLog.created_at, startOfWeek))
    .reduce((total, laborLog) => total + Number(laborLog.hours || 0), 0);
  const vehiclesTouchedToday = uniqueValues(
    todayActivities.map((activity) => activity.vehicle?.id)
  ).length;
  const recentVehicles = [...vehicleTouchById.entries()]
    .map(([vehicleId, touch]) => ({
      ...touch,
      vehicle: vehiclesById[vehicleId] ?? null,
    }))
    .filter((record) => record.vehicle)
    .sort((firstVehicle, secondVehicle) => {
      const firstDate = getDate(firstVehicle.lastActivityAt);
      const secondDate = getDate(secondVehicle.lastActivityAt);

      return (secondDate?.getTime() ?? 0) - (firstDate?.getTime() ?? 0);
    })
    .slice(0, 8);

  return {
    activeWorkOrders,
    recentVehicles,
    serviceCategoriesById,
    summary: {
      todayLaborHours,
      vehiclesTouchedToday,
      weekLaborHours,
    },
    todayActivities,
  };
}

function SummaryCard({ icon, label, value, helper }) {
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
          <AppIcon name={icon} size={15} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="text-lg font-black leading-5 text-slate-950">{value}</p>
        </div>
      </div>
      {helper && (
        <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">
          {helper}
        </p>
      )}
    </article>
  );
}

function MobileSummaryStrip({ summary }) {
  const stats = [
    {
      helper: "Today",
      icon: "clock",
      label: "Today",
      value: formatHours(summary.todayLaborHours),
    },
    {
      helper: "Week",
      icon: "labor",
      label: "Week",
      value: formatHours(summary.weekLaborHours),
    },
    {
      helper: "Touched",
      icon: "vehicle",
      label: "Vehicles",
      value: numberFormatter.format(summary.vehiclesTouchedToday),
    },
  ];

  return (
    <div className="grid grid-cols-3 divide-x divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {stats.map((stat) => (
        <div className="min-w-0 px-2 py-2 text-center" key={stat.label}>
          <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <AppIcon name={stat.icon} size={13} />
          </div>
          <p className="mt-1 truncate text-[10px] font-black uppercase tracking-wide text-slate-400">
            {stat.label}
          </p>
          <p className="text-base font-black leading-5 text-slate-950">
            {stat.value}
          </p>
          <p className="truncate text-[10px] font-semibold text-slate-500">
            {stat.helper}
          </p>
        </div>
      ))}
    </div>
  );
}

function MobileSectionTabs({ activeSection, counts, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 sm:hidden">
      {mobileSectionTabs.map((tab) => {
        const isActive = activeSection === tab.key;

        return (
          <button
            aria-pressed={isActive}
            className={`min-h-8 rounded-lg px-2 py-1 text-xs font-black transition ${
              isActive
                ? "bg-white text-emerald-700 shadow-sm ring-1 ring-inset ring-emerald-100"
                : "text-slate-600 hover:bg-white/60"
            }`}
            key={tab.key}
            onClick={() => onChange(tab.key)}
            type="button"
          >
            <span>{tab.label}</span>
            <span className="ml-1 text-[10px] text-slate-400">
              {counts[tab.key] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SectionHeader({ count, description, title }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-base font-black text-slate-950">{title}</h2>
        {description && (
          <p className="text-[11px] font-semibold leading-4 text-slate-500">
            {description}
          </p>
        )}
      </div>
      {typeof count === "number" && (
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-slate-500 ring-1 ring-inset ring-slate-200">
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({ children, title }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3">
      <p className="text-sm font-black text-slate-800">{title}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
        {children}
      </p>
    </div>
  );
}

function OpenVehicleButton({ onSelectVehicle, vehicle }) {
  return (
    <button
      aria-label={`Open ${getVehicleLine(vehicle)}`}
      className="inline-flex min-h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={!vehicle?.id}
      onClick={() => onSelectVehicle?.(vehicle.id)}
      type="button"
    >
      <AppIcon name="vehicle" size={13} />
      Open
    </button>
  );
}

function MiniMetric({ label, value }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1 rounded-lg bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-inset ring-slate-100">
      <span className="text-slate-400">{label}:</span>
      <span className="text-slate-950">{value}</span>
    </span>
  );
}

function ShowMoreButton({
  isExpanded,
  onClick,
  totalCount,
  visibleCount,
}) {
  if (totalCount <= visibleCount) {
    return null;
  }

  return (
    <button
      className="mt-2 inline-flex min-h-8 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-700 transition hover:bg-slate-50"
      onClick={onClick}
      type="button"
    >
      {isExpanded
        ? "Show Less"
        : `Show ${totalCount - visibleCount} More`}
    </button>
  );
}

function WorkOrderCard({
  onSelectVehicle,
  serviceCategoriesById,
  workOrder,
}) {
  const vehicle = workOrder.vehicle;
  const categoryLabel =
    workOrder.serviceCategory?.name ??
    getCategoryLabel(workOrder, serviceCategoriesById);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-sm font-black leading-5 text-slate-950">
            {getWorkOrderTitle(workOrder)}
          </h3>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <StatusBadge
              className="px-2 py-0.5 text-[10px]"
              label={getWorkOrderStatusLabel(workOrder.status)}
              status={workOrder.status}
            />
            <span className="max-w-[7rem] truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-inset ring-slate-200">
              {categoryLabel}
            </span>
          </div>
        </div>

        <p className="truncate text-xs font-semibold text-slate-600">
          {getVehicleLine(vehicle)}
        </p>

        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            <MiniMetric
              label="My labor"
              value={formatHours(workOrder.involvement.laborHours)}
            />
            <MiniMetric
              label="Last"
              value={formatRelativeDate(workOrder.involvement.lastActivityAt)}
            />
          </div>
          <OpenVehicleButton
            onSelectVehicle={onSelectVehicle}
            vehicle={vehicle}
          />
        </div>
      </div>
    </article>
  );
}

function ActivityItem({ activity, onSelectVehicle }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="min-w-0 text-sm font-black leading-5 text-slate-950">
              {activity.action}
            </p>
            <time className="shrink-0 text-[10px] font-black uppercase tracking-wide text-slate-400 sm:hidden">
              {formatRelativeDate(activity.date)}
            </time>
          </div>
          <p className="mt-0.5 truncate text-xs font-semibold text-slate-600">
            {getVehicleLine(activity.vehicle)}
          </p>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-slate-500">
            {activity.repairJob && (
              <span className="max-w-full truncate">
                {getWorkOrderTitle(activity.repairJob)}
              </span>
            )}
            <time className="hidden shrink-0 text-slate-400 sm:inline">
              {formatDateTime(activity.date)}
            </time>
          </div>
        </div>

        <OpenVehicleButton
          onSelectVehicle={onSelectVehicle}
          vehicle={activity.vehicle}
        />
      </div>
    </article>
  );
}

function RecentVehicleCard({ onSelectVehicle, record }) {
  const vehicle = record.vehicle;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1">
            <VehicleStatusBadge className="px-2 py-0.5 text-[10px]" status={vehicle.status} />
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-inset ring-slate-200">
              {record.actionCount} {record.actionCount === 1 ? "touch" : "touches"}
            </span>
          </div>
          <h3 className="mt-1.5 text-sm font-black text-slate-950">
            {displayValue(vehicle.stock_number, "No stock number")}
          </h3>
          <p className="truncate text-xs font-semibold text-slate-600">
            {getVehicleName(vehicle)}
          </p>
          <p className="mt-1 truncate text-[10px] font-black uppercase tracking-wide text-slate-400">
            {record.lastAction} - {formatRelativeDate(record.lastActivityAt)}
          </p>
        </div>

        <div className="flex justify-start sm:justify-end">
          <OpenVehicleButton onSelectVehicle={onSelectVehicle} vehicle={vehicle} />
        </div>
      </div>
    </article>
  );
}

function MyWorkPage({ currentProfile, onSelectVehicle }) {
  const [records, setRecords] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeMobileSection, setActiveMobileSection] = useState("active");
  const [showAllActiveWorkOrders, setShowAllActiveWorkOrders] = useState(false);
  const [showAllTodayActivities, setShowAllTodayActivities] = useState(false);
  const [showAllRecentVehicles, setShowAllRecentVehicles] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadMyWork() {
      if (!currentProfile?.id) {
        setRecords(null);
        setIsLoading(false);
        setErrorMessage("Unable to load My Work without a user profile.");
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data, error } = await fetchMyWorkData(currentProfile);

        if (!isMounted) {
          return;
        }

        if (error) {
          setRecords(null);
          setErrorMessage(error.message ?? "Could not load My Work.");
          return;
        }

        setRecords(data);
      } catch (error) {
        if (isMounted) {
          setRecords(null);
          setErrorMessage(error.message ?? "Could not load My Work.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadMyWork();

    return () => {
      isMounted = false;
    };
  }, [currentProfile]);

  const viewModel = useMemo(
    () => (records ? buildMyWorkViewModel(records, currentProfile) : null),
    [currentProfile, records]
  );
  const firstName = formatUserFirstName(currentProfile);
  const visibleActiveWorkOrders = viewModel
    ? showAllActiveWorkOrders
      ? viewModel.activeWorkOrders
      : viewModel.activeWorkOrders.slice(0, INITIAL_ACTIVE_WORK_ORDER_COUNT)
    : [];
  const visibleTodayActivities = viewModel
    ? showAllTodayActivities
      ? viewModel.todayActivities
      : viewModel.todayActivities.slice(0, INITIAL_TODAY_ACTIVITY_COUNT)
    : [];
  const visibleRecentVehicles = viewModel
    ? showAllRecentVehicles
      ? viewModel.recentVehicles
      : viewModel.recentVehicles.slice(0, INITIAL_RECENT_VEHICLE_COUNT)
    : [];
  const mobileSectionCounts = viewModel
    ? {
        active: viewModel.activeWorkOrders.length,
        activity: viewModel.todayActivities.length,
        vehicles: viewModel.recentVehicles.length,
      }
    : {};

  return (
    <div className="min-w-0 space-y-2.5 overflow-x-hidden">
      <section className="rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm sm:p-3">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,0.78fr)_minmax(420px,1.22fr)] lg:items-center">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700 sm:text-xs">
              {firstName}'s Workspace
            </p>
            <h1 className="text-xl font-black leading-7 text-slate-950 sm:text-2xl sm:leading-8">
              My Work
            </h1>
            <p className="max-w-2xl truncate text-[11px] font-semibold leading-4 text-slate-500 sm:text-xs sm:leading-5">
              Track your active work orders, labor, and recent vehicle activity.
            </p>
          </div>

          {!isLoading && !errorMessage && viewModel && (
            <div className="hidden min-w-0 gap-2 sm:grid sm:grid-cols-3">
              <SummaryCard
                helper="Logged today"
                icon="clock"
                label="Today's Hours"
                value={formatHours(viewModel.summary.todayLaborHours)}
              />
              <SummaryCard
                helper="Since Sunday"
                icon="labor"
                label="This Week"
                value={formatHours(viewModel.summary.weekLaborHours)}
              />
              <SummaryCard
                helper="Touched today"
                icon="vehicle"
                label="Vehicles Touched"
                value={numberFormatter.format(
                  viewModel.summary.vehiclesTouchedToday
                )}
              />
            </div>
          )}
        </div>

        {!isLoading && !errorMessage && viewModel && (
          <div className="mt-2 space-y-2 sm:hidden">
            <MobileSummaryStrip summary={viewModel.summary} />
            <MobileSectionTabs
              activeSection={activeMobileSection}
              counts={mobileSectionCounts}
              onChange={setActiveMobileSection}
            />
          </div>
        )}
      </section>

      {isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500 shadow-sm">
          Loading your work...
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && viewModel && (
        <>
          <div className="sm:hidden">
            {activeMobileSection === "active" && (
              <section className="min-w-0 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm">
                <SectionHeader
                  count={viewModel.activeWorkOrders.length}
                  title="Active Work"
                />

                <div className="mt-2 space-y-1.5">
                  {viewModel.activeWorkOrders.length === 0 ? (
                    <EmptyState title="No active work yet.">
                      Start by opening a vehicle and adding labor, parts, or
                      vendor work.
                    </EmptyState>
                  ) : (
                    visibleActiveWorkOrders.map((workOrder) => (
                      <WorkOrderCard
                        key={workOrder.id}
                        onSelectVehicle={onSelectVehicle}
                        serviceCategoriesById={viewModel.serviceCategoriesById}
                        workOrder={workOrder}
                      />
                    ))
                  )}
                </div>

                <ShowMoreButton
                  isExpanded={showAllActiveWorkOrders}
                  onClick={() =>
                    setShowAllActiveWorkOrders((currentValue) => !currentValue)
                  }
                  totalCount={viewModel.activeWorkOrders.length}
                  visibleCount={INITIAL_ACTIVE_WORK_ORDER_COUNT}
                />
              </section>
            )}

            {activeMobileSection === "activity" && (
              <section className="min-w-0 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm">
                <SectionHeader
                  count={viewModel.todayActivities.length}
                  title="Today Activity"
                />

                <div className="mt-2 space-y-1.5">
                  {viewModel.todayActivities.length === 0 ? (
                    <EmptyState title="No activity today.">
                      Your actions will appear here when you add labor, parts,
                      documents, receive POs, or return parts.
                    </EmptyState>
                  ) : (
                    visibleTodayActivities.map((activity) => (
                      <ActivityItem
                        activity={activity}
                        key={activity.id}
                        onSelectVehicle={onSelectVehicle}
                      />
                    ))
                  )}
                </div>

                <ShowMoreButton
                  isExpanded={showAllTodayActivities}
                  onClick={() =>
                    setShowAllTodayActivities((currentValue) => !currentValue)
                  }
                  totalCount={viewModel.todayActivities.length}
                  visibleCount={INITIAL_TODAY_ACTIVITY_COUNT}
                />
              </section>
            )}

            {activeMobileSection === "vehicles" && (
              <section className="min-w-0 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm">
                <SectionHeader
                  count={viewModel.recentVehicles.length}
                  title="Touched Vehicles"
                />

                <div className="mt-2 space-y-1.5">
                  {viewModel.recentVehicles.length === 0 ? (
                    <EmptyState title="No recently touched vehicles.">
                      Vehicles will appear here after you log or handle work.
                    </EmptyState>
                  ) : (
                    visibleRecentVehicles.map((record) => (
                      <RecentVehicleCard
                        key={record.vehicle.id}
                        onSelectVehicle={onSelectVehicle}
                        record={record}
                      />
                    ))
                  )}
                </div>

                <ShowMoreButton
                  isExpanded={showAllRecentVehicles}
                  onClick={() =>
                    setShowAllRecentVehicles((currentValue) => !currentValue)
                  }
                  totalCount={viewModel.recentVehicles.length}
                  visibleCount={INITIAL_RECENT_VEHICLE_COUNT}
                />
              </section>
            )}
          </div>

          <div className="hidden space-y-2.5 sm:block">
            <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
              <section className="min-w-0 rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-sm sm:p-3">
                <SectionHeader
                  count={viewModel.activeWorkOrders.length}
                  description="Open work connected to your activity."
                  title="My Active Work Orders"
                />

                <div className="mt-2 space-y-1.5">
                  {viewModel.activeWorkOrders.length === 0 ? (
                    <EmptyState title="No active work yet.">
                      Start by opening a vehicle and adding labor, parts,
                      documents, or vendor work.
                    </EmptyState>
                  ) : (
                    visibleActiveWorkOrders.map((workOrder) => (
                      <WorkOrderCard
                        key={workOrder.id}
                        onSelectVehicle={onSelectVehicle}
                        serviceCategoriesById={viewModel.serviceCategoriesById}
                        workOrder={workOrder}
                      />
                    ))
                  )}
                </div>

                <ShowMoreButton
                  isExpanded={showAllActiveWorkOrders}
                  onClick={() =>
                    setShowAllActiveWorkOrders((currentValue) => !currentValue)
                  }
                  totalCount={viewModel.activeWorkOrders.length}
                  visibleCount={INITIAL_ACTIVE_WORK_ORDER_COUNT}
                />
              </section>

              <section className="min-w-0 rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-sm sm:p-3">
                <SectionHeader
                  count={viewModel.todayActivities.length}
                  description="Actions connected to your profile today."
                  title="My Today Activity"
                />

                <div className="mt-2 space-y-1.5">
                  {viewModel.todayActivities.length === 0 ? (
                    <EmptyState title="No activity today.">
                      Your actions will appear here when you add labor, request
                      parts, upload documents, receive POs, or return parts.
                    </EmptyState>
                  ) : (
                    visibleTodayActivities.map((activity) => (
                      <ActivityItem
                        activity={activity}
                        key={activity.id}
                        onSelectVehicle={onSelectVehicle}
                      />
                    ))
                  )}
                </div>

                <ShowMoreButton
                  isExpanded={showAllTodayActivities}
                  onClick={() =>
                    setShowAllTodayActivities((currentValue) => !currentValue)
                  }
                  totalCount={viewModel.todayActivities.length}
                  visibleCount={INITIAL_TODAY_ACTIVITY_COUNT}
                />
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-sm sm:p-3">
              <SectionHeader
                count={viewModel.recentVehicles.length}
                description="Vehicles where you recently logged or handled work."
                title="Recently Touched Vehicles"
              />

              <div className="mt-2 grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                {viewModel.recentVehicles.length === 0 ? (
                  <div className="md:col-span-2 xl:col-span-3">
                    <EmptyState title="No recently touched vehicles.">
                      Vehicles will appear here after you log labor, create work,
                      request parts, upload documents, receive POs, or return parts.
                    </EmptyState>
                  </div>
                ) : (
                  visibleRecentVehicles.map((record) => (
                    <RecentVehicleCard
                      key={record.vehicle.id}
                      onSelectVehicle={onSelectVehicle}
                      record={record}
                    />
                  ))
                )}
              </div>

              <ShowMoreButton
                isExpanded={showAllRecentVehicles}
                onClick={() =>
                  setShowAllRecentVehicles((currentValue) => !currentValue)
                }
                totalCount={viewModel.recentVehicles.length}
                visibleCount={INITIAL_RECENT_VEHICLE_COUNT}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

export default MyWorkPage;
