import {
  formatReturnReason,
  getReturnedPurchaseOrderItems,
  isPurchaseOrderItemReturned,
} from "./partReturns";
import {
  buildSearchText,
  findMatchingVehicles,
  getVehicleSearchValues,
  matchesSearchText,
  normalizeSearchText,
} from "./searchText";

export const PART_QUEUE_TABS = [
  { key: "needs_po", label: "Needs PO" },
  { key: "pending_review", label: "Pending Review" },
  { key: "ordered", label: "Ordered" },
  { key: "received", label: "Received" },
  { key: "returned", label: "Returned" },
  { key: "all", label: "All" },
];

export const partSourceLabels = {
  in_house: "In-house / Available",
  needs_to_buy: "Needs to Buy",
};

export const approvalLabels = {
  not_required: "Not Required",
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};

export const partStatusLabels = {
  cancelled: "Cancelled",
  requested: "Requested",
  ordered: "Ordered",
  received: "Received",
  returned: "Returned",
  installed: "Installed",
};

const completedPartStatuses = ["ordered", "received", "installed", "cancelled"];
const inactivePurchaseOrderItemStatuses = ["cancelled", "returned"];
const inactivePurchaseOrderStatuses = ["cancelled"];

function normalizeSearch(value) {
  return normalizeSearchText(value);
}

export function formatPartLabel(value, labels = {}) {
  if (labels[value]) {
    return labels[value];
  }

  if (!value) {
    return "Not available";
  }

  return String(value)
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatSearchLabel(value, labels = {}) {
  return value ? formatPartLabel(value, labels) : "";
}

function getVehicleNameSearchValues(vehicle) {
  return [vehicle?.year, vehicle?.make, vehicle?.model, vehicle?.trim]
    .filter(Boolean)
    .join(" ");
}

function getPartVehicleIds(part) {
  return [
    part?.vehicle_id,
    part?.vehicle?.id,
    part?.vehicleContext?.id,
    part?.repairJob?.vehicle_id,
    part?.repairJob?.vehicle?.id,
    part?.repairJob?.vehicleContext?.id,
    part?.repair_job?.vehicle_id,
    part?.repair_jobs?.vehicle_id,
  ]
    .filter(Boolean)
    .map(String);
}

function getPartVehicleMatchText(part) {
  return buildSearchText([
    part?.searchText,
    part?.vehicleSearchText,
    part?.vehicleLabel,
    part?.vehicleDisplay,
    ...getVehicleSearchValues(part?.vehicleContext),
    ...getVehicleSearchValues(part?.vehicle),
    ...getVehicleSearchValues(part?.vehicles),
    part?.repairJob?.vehicleSearchText,
    ...getVehicleSearchValues(part?.repairJob?.vehicleContext),
    ...getVehicleSearchValues(part?.repairJob?.vehicle),
    ...getVehicleSearchValues(part?.repair_jobs?.vehicle),
  ]);
}

function doesPartMatchVehicle(part, matchedVehicles = []) {
  if (matchedVehicles.length === 0) {
    return false;
  }

  const partVehicleIds = new Set(getPartVehicleIds(part));
  const partVehicleText = getPartVehicleMatchText(part);

  return matchedVehicles.some((vehicle) => {
    const vehicleName = buildSearchText([
      getVehicleNameSearchValues(vehicle),
      vehicle?.color,
    ]);

    return (
      (vehicle?.id && partVehicleIds.has(String(vehicle.id))) ||
      (vehicle?.stock_number &&
        partVehicleText.includes(normalizeSearch(vehicle.stock_number))) ||
      (vehicle?.vin && partVehicleText.includes(normalizeSearch(vehicle.vin))) ||
      (vehicleName && partVehicleText.includes(vehicleName))
    );
  });
}

function getPartVendorIds(part) {
  return [
    part?.selected_vendor_id,
    part?.selectedVendor?.id,
    part?.selectedQuote?.vendor_id,
    part?.latestQuote?.vendor_id,
    ...(part?.quotes ?? []).map((quote) => quote.vendor_id),
    ...(part?.purchaseOrderItems ?? []).flatMap((item) => [
      item.purchaseOrder?.vendor_id,
      item.purchaseOrder?.vendor?.id,
    ]),
  ]
    .filter(Boolean)
    .map(String);
}

function getPartVendorNames(part) {
  return [
    part?.selectedVendor?.name,
    part?.selectedQuote?.vendor_name_snapshot,
    part?.selectedQuote?.display_vendor_name,
    part?.latestQuote?.vendor_name_snapshot,
    part?.latestQuote?.display_vendor_name,
    ...(part?.quotes ?? []).flatMap((quote) => [
      quote.vendor_name_snapshot,
      quote.display_vendor_name,
    ]),
    ...(part?.purchaseOrderItems ?? []).map(
      (item) => item.purchaseOrder?.vendor?.name
    ),
  ]
    .filter(Boolean)
    .map((name) => normalizeSearch(name));
}

function partMatchesVendorFilter(part, vendorId, vendorName) {
  const normalizedVendorId = String(vendorId ?? "").trim();
  const normalizedVendorName = normalizeSearch(vendorName);

  if (!normalizedVendorId && !normalizedVendorName) {
    return true;
  }

  if (
    normalizedVendorId &&
    getPartVendorIds(part).includes(normalizedVendorId)
  ) {
    return true;
  }

  return (
    normalizedVendorName &&
    getPartVendorNames(part).some((name) => name === normalizedVendorName)
  );
}

function partMatchesVehicleFilter(part, vehicleId) {
  const normalizedVehicleId = String(vehicleId ?? "").trim();

  if (!normalizedVehicleId) {
    return true;
  }

  return getPartVehicleIds(part).includes(normalizedVehicleId);
}

export function getVehicleName(vehicle) {
  if (!vehicle) {
    return "";
  }

  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter(Boolean)
    .join(" ");
}

export function formatPartQueueVehicleLabel(part) {
  const vehicle = part?.vehicle;

  if (!vehicle) {
    return "Vehicle not found";
  }

  const stockNumber = vehicle.stock_number || "No stock number";
  const vehicleName = getVehicleName(vehicle);

  return vehicleName ? `${stockNumber} - ${vehicleName}` : stockNumber;
}

export function hasActivePurchaseOrderItem(part) {
  return (part?.purchaseOrderItems ?? []).some((item) => {
    const purchaseOrder = item.purchaseOrder;
    const itemStatus = item.status ?? "ordered";
    const purchaseOrderStatus = purchaseOrder?.status ?? "ordered";

    return (
      !isPurchaseOrderItemReturned(item) &&
      !inactivePurchaseOrderItemStatuses.includes(itemStatus) &&
      !inactivePurchaseOrderStatuses.includes(purchaseOrderStatus)
    );
  });
}

export function getPrimaryPurchaseOrderItem(part) {
  return (
    (part?.purchaseOrderItems ?? []).find((item) => {
      const itemStatus = item.status ?? "ordered";
      const purchaseOrderStatus = item.purchaseOrder?.status ?? "ordered";

      return (
        !isPurchaseOrderItemReturned(item) &&
        !inactivePurchaseOrderItemStatuses.includes(itemStatus) &&
        !inactivePurchaseOrderStatuses.includes(purchaseOrderStatus)
      );
    }) ?? null
  );
}

export function isPartReturned(part) {
  return (
    part?.status === "returned" ||
    getReturnedPurchaseOrderItems(part).length > 0
  );
}

function numberOrNull(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function getSelectedQuote(part) {
  return part?.selectedQuote ?? null;
}

export function getSelectedVendorName(part) {
  const selectedQuote = getSelectedQuote(part);
  const primaryPurchaseOrderItem = getPrimaryPurchaseOrderItem(part);

  return (
    selectedQuote?.vendor_name_snapshot ||
    part?.selectedVendor?.name ||
    primaryPurchaseOrderItem?.purchaseOrder?.vendor?.name ||
    (selectedQuote?.display_vendor_name === "Unknown vendor"
      ? ""
      : selectedQuote?.display_vendor_name) ||
    (part?.selected_vendor_id ? "Selected vendor" : "")
  );
}

export function getSelectedVendorId(part) {
  const selectedQuote = getSelectedQuote(part);

  return (
    part?.selected_vendor_id ||
    selectedQuote?.vendor_id ||
    getPrimaryPurchaseOrderItem(part)?.purchaseOrder?.vendor_id ||
    ""
  );
}

export function getSelectedUnitCost(part) {
  return (
    numberOrNull(part?.quoted_unit_cost) ??
    numberOrNull(part?.selectedQuote?.unit_price) ??
    numberOrNull(part?.unit_cost) ??
    0
  );
}

export function getPartEstimatedTotal(part) {
  const savedTotal = numberOrNull(part?.quoted_total_cost);

  if (savedTotal !== null) {
    return savedTotal;
  }

  const selectedQuoteTotal = numberOrNull(part?.selectedQuote?.total_price);

  if (selectedQuoteTotal !== null && selectedQuoteTotal > 0) {
    return selectedQuoteTotal;
  }

  const quantity = numberOrNull(part?.quantity) ?? 1;

  return quantity * getSelectedUnitCost(part);
}

export function isPartNeedsPo(part) {
  return (
    part?.part_source === "needs_to_buy" &&
    part?.approval_status !== "rejected" &&
    !isPartReturned(part) &&
    !completedPartStatuses.includes(part?.status) &&
    !hasActivePurchaseOrderItem(part)
  );
}

export function isPartPendingReview(part) {
  return (
    part?.part_source === "needs_to_buy" &&
    part?.approval_status === "pending" &&
    part?.status !== "cancelled"
  );
}

export function isPartReceived(part) {
  if (isPartReturned(part)) {
    return false;
  }

  if (["received", "installed"].includes(part?.status)) {
    return true;
  }

  return (part?.purchaseOrderItems ?? []).some((item) => {
    return (
      item.status === "received" ||
      item.purchaseOrder?.status === "received"
    );
  });
}

export function isPartOrdered(part) {
  if (isPartReturned(part) || isPartReceived(part)) {
    return false;
  }

  return part?.status === "ordered" || hasActivePurchaseOrderItem(part);
}

export function isPartIssue(part) {
  if (isPartReturned(part)) {
    return false;
  }

  return (
    part?.approval_status === "rejected" ||
    part?.status === "cancelled" ||
    part?.latestQuote?.quote_status === "rejected" ||
    part?.latestQuote?.quote_status === "unavailable" ||
    part?.latestQuote?.availability === "unavailable"
  );
}

export function getPartQueueStatus(part) {
  if (isPartReturned(part)) {
    return "returned";
  }

  if (isPartReceived(part)) {
    return "received";
  }

  if (isPartOrdered(part)) {
    return "ordered";
  }

  if (isPartNeedsPo(part)) {
    return "needs_po";
  }

  if (isPartIssue(part)) {
    return "issues";
  }

  if (isPartPendingReview(part)) {
    return "pending_review";
  }

  return "all";
}

function getPartLifecycleBadge(part) {
  if (isPartReturned(part)) {
    return {
      key: "status-returned",
      kind: "status",
      label: "Returned",
      value: "returned",
    };
  }

  if (isPartReceived(part)) {
    return {
      key: "status-received",
      kind: "status",
      label: "Received",
      value: "received",
    };
  }

  if (getPrimaryPurchaseOrderItem(part)) {
    return {
      key: "status-po-created",
      kind: "status",
      label: "PO Created",
      value: "po_created",
    };
  }

  if (isPartOrdered(part)) {
    return {
      key: "status-ordered",
      kind: "status",
      label: "Ordered",
      value: "ordered",
    };
  }

  if (isPartNeedsPo(part)) {
    return {
      key: "status-needs-po",
      kind: "status",
      label: "Needs to Buy",
      value: "needs_po",
    };
  }

  return {
    key: `status-${part?.status ?? "tracked"}`,
    kind: "status",
    label: formatPartLabel(part?.status, partStatusLabels),
    value: part?.status ?? "tracked",
  };
}

export function getRequiredPartBadges(part) {
  const lifecycleBadge = getPartLifecycleBadge(part);

  if (lifecycleBadge.value === "returned") {
    return [lifecycleBadge];
  }

  if (
    lifecycleBadge.value === "needs_po" &&
    part?.part_source === "needs_to_buy" &&
    part?.approval_status === "pending"
  ) {
    return [
      {
        key: "approval-pending",
        kind: "approval",
        label: formatPartLabel(part.approval_status, approvalLabels),
        value: part.approval_status,
      },
    ];
  }

  const badges = [lifecycleBadge];
  const lifecycleStatesThatHideSource = new Set([
    "ordered",
    "po_created",
    "received",
  ]);
  const sourceLabel = formatPartLabel(part?.part_source, partSourceLabels);

  if (
    part?.part_source &&
    !lifecycleStatesThatHideSource.has(lifecycleBadge.value) &&
    sourceLabel !== lifecycleBadge.label
  ) {
    badges.push({
      key: `source-${part.part_source}`,
      kind: "source",
      label: sourceLabel,
      value: part.part_source,
    });
  }

  if (part?.approval_status) {
    badges.push({
      key: `approval-${part.approval_status}`,
      kind: "approval",
      label: formatPartLabel(part.approval_status, approvalLabels),
      value: part.approval_status,
    });
  }

  return badges;
}

export function partMatchesQueueTab(part, tabKey) {
  if (tabKey === "all") {
    return true;
  }

  if (tabKey === "returned") {
    return isPartReturned(part);
  }

  if (isPartReturned(part)) {
    return false;
  }

  if (tabKey === "needs_po") {
    return isPartNeedsPo(part);
  }

  if (tabKey === "pending_review") {
    return isPartPendingReview(part);
  }

  if (tabKey === "ordered") {
    return isPartOrdered(part);
  }

  if (tabKey === "received") {
    return isPartReceived(part);
  }

  if (tabKey === "issues") {
    return isPartIssue(part);
  }

  return true;
}

export function getPartQueueCounts(parts = []) {
  return PART_QUEUE_TABS.reduce((counts, tab) => {
    counts[tab.key] =
      tab.key === "all"
        ? parts.length
        : parts.filter((part) => partMatchesQueueTab(part, tab.key)).length;
    return counts;
  }, {});
}

export function getPartQueueBadge(status) {
  if (status === "needs_po") {
    return {
      className: "bg-amber-50 text-amber-800 ring-amber-200",
      label: "Needs PO",
    };
  }

  if (status === "pending_review") {
    return {
      className: "bg-blue-50 text-blue-700 ring-blue-200",
      label: "Pending Review",
    };
  }

  if (status === "ordered") {
    return {
      className: "bg-sky-50 text-sky-700 ring-sky-200",
      label: "Ordered",
    };
  }

  if (status === "received") {
    return {
      className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      label: "Received",
    };
  }

  if (status === "returned") {
    return {
      className: "bg-red-50 text-red-700 ring-red-200",
      label: "Returned",
    };
  }

  if (status === "issues") {
    return {
      className: "bg-red-50 text-red-700 ring-red-200",
      label: "Issue",
    };
  }

  return {
    className: "bg-slate-100 text-slate-700 ring-slate-200",
    label: "Tracked",
  };
}

export function getPartQueueSearchText(part) {
  const workOrder = part?.repairJob;
  const vehicle = part?.vehicle;
  const latestQuote = part?.latestQuote;
  const selectedQuote = part?.selectedQuote;
  const purchaseOrderItem = getPrimaryPurchaseOrderItem(part);
  const purchaseOrderVendor = purchaseOrderItem?.purchaseOrder?.vendor;
  const returnedItems = getReturnedPurchaseOrderItems(part);

  return buildSearchText([
    part?.part_name,
    part?.notes,
    part?.status,
    part?.approval_status,
    part?.part_source,
    formatSearchLabel(part?.status, partStatusLabels),
    formatSearchLabel(part?.approval_status, approvalLabels),
    formatSearchLabel(part?.part_source, partSourceLabels),
    part?.createdByProfile?.full_name,
    part?.createdByProfile?.email,
    part?.approvedByProfile?.full_name,
    part?.approvedByProfile?.email,
    part?.vehicleVin,
    part?.vehicle_vin,
    part?.vehicleSearchText,
    ...getVehicleSearchValues(part?.vehicleContext),
    ...getVehicleSearchValues(vehicle),
    ...getVehicleSearchValues(part?.vehicles),
    ...getVehicleSearchValues(workOrder?.vehicleContext),
    ...getVehicleSearchValues(workOrder?.vehicle),
    ...getVehicleSearchValues(workOrder?.vehicles),
    workOrder?.vehicleVin,
    workOrder?.vehicleSearchText,
    workOrder?.title,
    workOrder?.category,
    workOrder?.status,
    workOrder?.priority,
    workOrder?.serviceCategory?.name,
    latestQuote?.vendor_name_snapshot,
    latestQuote?.display_vendor_name,
    latestQuote?.raw_part_name,
    latestQuote?.quote_status,
    latestQuote?.availability,
    latestQuote?.notes,
    selectedQuote?.vendor_name_snapshot,
    selectedQuote?.display_vendor_name,
    selectedQuote?.raw_part_name,
    selectedQuote?.quote_status,
    selectedQuote?.availability,
    selectedQuote?.notes,
    part?.selectedVendor?.name,
    purchaseOrderVendor?.name,
    purchaseOrderItem?.description,
    purchaseOrderItem?.notes,
    purchaseOrderItem?.status,
    purchaseOrderItem?.purchaseOrder?.id,
    purchaseOrderItem?.purchaseOrder?.id
      ? `PO ${purchaseOrderItem.purchaseOrder.id}`
      : "",
    purchaseOrderItem?.purchaseOrder?.status,
    purchaseOrderItem?.purchaseOrder?.notes,
    purchaseOrderItem?.purchaseOrder?.orderedByProfile?.full_name,
    purchaseOrderItem?.purchaseOrder?.orderedByProfile?.email,
    purchaseOrderItem?.purchaseOrder?.receivedByProfile?.full_name,
    purchaseOrderItem?.purchaseOrder?.receivedByProfile?.email,
    ...returnedItems.flatMap((item) => [
      item.description,
      item.status,
      item.return_notes,
      formatReturnReason(item.return_reason),
      item.purchaseOrder?.vendor?.name,
      item.returnedByProfile?.full_name,
      item.returnedByProfile?.email,
    ]),
  ]);
}

export function filterPartsQueue(
  parts = [],
  {
    search = "",
    tab = "needs_po",
    vehicleId = "",
    vehicleSearchIndex = [],
    vendorId = "",
    vendorName = "",
  } = {}
) {
  const normalizedSearch = normalizeSearch(search);
  const matchedVehicles = findMatchingVehicles(vehicleSearchIndex, search);

  return parts.filter((part) => {
    if (!partMatchesQueueTab(part, tab)) {
      return false;
    }

    if (!partMatchesVendorFilter(part, vendorId, vendorName)) {
      return false;
    }

    if (!partMatchesVehicleFilter(part, vehicleId)) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return (
      matchesSearchText(part.searchText || getPartQueueSearchText(part), search) ||
      doesPartMatchVehicle(part, matchedVehicles)
    );
  });
}
