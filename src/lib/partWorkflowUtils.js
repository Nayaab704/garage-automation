export const PART_QUEUE_TABS = [
  { key: "needs_po", label: "Needs PO" },
  { key: "pending_review", label: "Pending Review" },
  { key: "ordered", label: "Ordered" },
  { key: "received", label: "Received" },
  { key: "issues", label: "Issues" },
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
  installed: "Installed",
};

const completedPartStatuses = ["ordered", "received", "installed", "cancelled"];
const inactivePurchaseOrderItemStatuses = ["cancelled", "returned"];
const inactivePurchaseOrderStatuses = ["cancelled"];

function normalizeSearch(value) {
  return String(value ?? "").trim().toLowerCase();
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

  return vehicleName ? `${stockNumber} · ${vehicleName}` : stockNumber;
}

export function hasActivePurchaseOrderItem(part) {
  return (part?.purchaseOrderItems ?? []).some((item) => {
    const purchaseOrder = item.purchaseOrder;
    const itemStatus = item.status ?? "ordered";
    const purchaseOrderStatus = purchaseOrder?.status ?? "ordered";

    return (
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
        !inactivePurchaseOrderItemStatuses.includes(itemStatus) &&
        !inactivePurchaseOrderStatuses.includes(purchaseOrderStatus)
      );
    }) ?? null
  );
}

export function isPartNeedsPo(part) {
  return (
    part?.part_source === "needs_to_buy" &&
    part?.approval_status !== "rejected" &&
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
  if (isPartReceived(part)) {
    return false;
  }

  return part?.status === "ordered" || hasActivePurchaseOrderItem(part);
}

export function isPartIssue(part) {
  return (
    part?.approval_status === "rejected" ||
    part?.status === "cancelled" ||
    part?.latestQuote?.quote_status === "rejected" ||
    part?.latestQuote?.quote_status === "unavailable" ||
    part?.latestQuote?.availability === "unavailable"
  );
}

export function getPartQueueStatus(part) {
  if (isPartNeedsPo(part)) {
    return "needs_po";
  }

  if (isPartIssue(part)) {
    return "issues";
  }

  if (isPartReceived(part)) {
    return "received";
  }

  if (isPartOrdered(part)) {
    return "ordered";
  }

  if (isPartPendingReview(part)) {
    return "pending_review";
  }

  return "all";
}

export function partMatchesQueueTab(part, tabKey) {
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
  const purchaseOrderItem = getPrimaryPurchaseOrderItem(part);
  const purchaseOrderVendor = purchaseOrderItem?.purchaseOrder?.vendor;

  return [
    part?.part_name,
    part?.notes,
    vehicle?.stock_number,
    vehicle?.year,
    vehicle?.make,
    vehicle?.model,
    vehicle?.trim,
    vehicle?.color,
    workOrder?.title,
    workOrder?.category,
    workOrder?.serviceCategory?.name,
    latestQuote?.vendor_name_snapshot,
    latestQuote?.raw_part_name,
    purchaseOrderVendor?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterPartsQueue(parts = [], { search = "", tab = "needs_po" } = {}) {
  const normalizedSearch = normalizeSearch(search);

  return parts.filter((part) => {
    if (!partMatchesQueueTab(part, tab)) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return getPartQueueSearchText(part).includes(normalizedSearch);
  });
}
