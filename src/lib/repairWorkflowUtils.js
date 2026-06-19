export const REPAIR_QUEUE_TABS = [
  { key: "open", label: "Open" },
  { key: "waiting_parts", label: "Waiting Parts" },
  { key: "urgent", label: "Urgent" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

export const repairStatusLabels = {
  approved: "Approved",
  blocked: "Blocked",
  cancelled: "Cancelled",
  completed: "Completed",
  in_progress: "In Progress",
  needed: "Needed",
  waiting_parts: "Waiting Parts",
};

export const repairPriorityLabels = {
  critical: "Critical",
  high: "High",
  low: "Low",
  medium: "Medium",
  urgent: "Urgent",
};

const completedStatuses = ["completed", "closed", "cancelled"];
const inProgressStatuses = ["approved", "in_progress", "repairing"];
const waitingPartStatuses = ["ordered", "requested", "waiting_parts"];
const receivedPartStatuses = ["received", "installed", "cancelled"];
const inactivePurchaseOrderItemStatuses = ["cancelled", "returned"];
const receivedPurchaseOrderItemStatuses = ["received", "installed"];
const urgentPriorities = ["urgent", "critical", "high"];

function normalizeSearch(value) {
  return String(value ?? "").trim().toLowerCase();
}

function numberOrZero(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function formatRepairLabel(value, labels = {}) {
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

export function getRepairVehicleName(vehicle) {
  if (!vehicle) {
    return "";
  }

  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter(Boolean)
    .join(" ");
}

export function formatRepairJobVehicleLabel(job) {
  const vehicle = job?.vehicle;

  if (!vehicle) {
    return "Vehicle not found";
  }

  const stockNumber = vehicle.stock_number || "No stock number";
  const vehicleName = getRepairVehicleName(vehicle);

  return vehicleName ? `${stockNumber} - ${vehicleName}` : stockNumber;
}

export function isRepairJobUrgent(job) {
  return (
    !isRepairJobCompleted(job) &&
    urgentPriorities.includes(String(job?.priority ?? "").toLowerCase())
  );
}

export function isRepairJobCompleted(job) {
  return completedStatuses.includes(job?.status);
}

export function isRepairJobInProgress(job) {
  return inProgressStatuses.includes(job?.status);
}

function isPartWaiting(part) {
  if (part?.part_source !== "needs_to_buy") {
    return false;
  }

  if (part?.approval_status === "rejected") {
    return false;
  }

  if (receivedPartStatuses.includes(part?.status)) {
    return false;
  }

  if (waitingPartStatuses.includes(part?.status)) {
    return true;
  }

  return true;
}

function hasUnreceivedPurchaseOrderItem(part) {
  return (part?.purchaseOrderItems ?? []).some((item) => {
    const itemStatus = item.status ?? "ordered";

    return (
      !inactivePurchaseOrderItemStatuses.includes(itemStatus) &&
      !receivedPurchaseOrderItemStatuses.includes(itemStatus)
    );
  });
}

export function isRepairJobWaitingParts(job) {
  if (isRepairJobCompleted(job)) {
    return false;
  }

  if (job?.status === "waiting_parts") {
    return true;
  }

  return (job?.parts ?? []).some(
    (part) => isPartWaiting(part) || hasUnreceivedPurchaseOrderItem(part)
  );
}

export function isRepairJobOpen(job) {
  return !isRepairJobCompleted(job);
}

export function getRepairJobCounts(job) {
  return {
    laborHours: (job?.laborLogs ?? []).reduce(
      (total, laborLog) => total + numberOrZero(laborLog.hours),
      0
    ),
    partsCount: job?.parts?.length ?? 0,
    photosCount: job?.photos?.length ?? 0,
    thirdPartyCount: job?.thirdPartyRepairs?.length ?? 0,
  };
}

export function getRepairJobQueueStatus(job) {
  if (isRepairJobWaitingParts(job)) {
    return "waiting_parts";
  }

  if (isRepairJobUrgent(job)) {
    return "urgent";
  }

  if (isRepairJobCompleted(job)) {
    return "completed";
  }

  if (isRepairJobInProgress(job)) {
    return "in_progress";
  }

  return "open";
}

export function repairJobMatchesTab(job, tabKey) {
  if (tabKey === "open") {
    return isRepairJobOpen(job);
  }

  if (tabKey === "waiting_parts") {
    return isRepairJobWaitingParts(job);
  }

  if (tabKey === "urgent") {
    return isRepairJobUrgent(job);
  }

  if (tabKey === "in_progress") {
    return isRepairJobInProgress(job);
  }

  if (tabKey === "completed") {
    return isRepairJobCompleted(job);
  }

  return true;
}

export function getRepairQueueCounts(jobs = []) {
  return REPAIR_QUEUE_TABS.reduce((counts, tab) => {
    counts[tab.key] =
      tab.key === "all"
        ? jobs.length
        : jobs.filter((job) => repairJobMatchesTab(job, tab.key)).length;
    return counts;
  }, {});
}

export function getRepairJobSearchText(job) {
  return [
    job?.title,
    job?.notes,
    job?.category,
    job?.serviceCategory?.name,
    job?.vehicle?.stock_number,
    job?.vehicle?.year,
    job?.vehicle?.make,
    job?.vehicle?.model,
    job?.vehicle?.trim,
    job?.vehicle?.status,
    ...(job?.parts ?? []).flatMap((part) => [
      part.part_name,
      part.selectedVendor?.name,
      part.selectedQuote?.vendor_name_snapshot,
      part.purchaseOrderItems?.[0]?.purchaseOrder?.vendor?.name,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterRepairsQueue(jobs = [], { search = "", tab = "open" } = {}) {
  const normalizedSearch = normalizeSearch(search);

  return jobs.filter((job) => {
    if (!repairJobMatchesTab(job, tab)) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return getRepairJobSearchText(job).includes(normalizedSearch);
  });
}
