export const defaultWorkOrderStatus = "needed";

export const workOrderStatusLabels = {
  approved: "Approved",
  blocked: "Blocked",
  cancelled: "Cancelled",
  completed: "Completed",
  in_progress: "In Progress",
  needed: "Needed",
  ordered: "Ordered",
  parts_needed: "Parts Needed",
  waiting_parts: "Waiting Parts",
};

export const workOrderStatusOptions = [
  "needed",
  "approved",
  "in_progress",
  "parts_needed",
  "waiting_parts",
  "ordered",
  "blocked",
  "completed",
  "cancelled",
];

export const workOrderStatusOrder = workOrderStatusOptions;

const terminalWorkOrderStatuses = new Set([
  "blocked",
  "cancelled",
  "completed",
]);

const waitingForPartsStatuses = new Set([
  "ordered",
  "parts_needed",
  "waiting_for_parts",
  "waiting_parts",
]);

const receivedPartStatuses = new Set(["installed", "received"]);
const earlyPartNeededStatuses = new Set(["", "approved", "needed"]);

function normalizeStatus(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function getWorkOrderStatusLabel(status) {
  const normalizedStatus = normalizeStatus(status);

  if (workOrderStatusLabels[normalizedStatus]) {
    return workOrderStatusLabels[normalizedStatus];
  }

  if (!normalizedStatus) {
    return workOrderStatusLabels[defaultWorkOrderStatus];
  }

  return normalizedStatus
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function isKnownWorkOrderStatus(status) {
  return Boolean(workOrderStatusLabels[normalizeStatus(status)]);
}

export function isWorkOrderStatusWaitingForParts(status) {
  return waitingForPartsStatuses.has(normalizeStatus(status));
}

function canAutoAdvanceStatus(status) {
  const normalizedStatus = normalizeStatus(status);

  if (!normalizedStatus) {
    return true;
  }

  if (terminalWorkOrderStatuses.has(normalizedStatus)) {
    return false;
  }

  return isKnownWorkOrderStatus(normalizedStatus);
}

export function getWorkOrderStatusAfterPartAdded(currentStatus, partRequest) {
  if (partRequest?.part_source !== "needs_to_buy") {
    return null;
  }

  const normalizedStatus = normalizeStatus(currentStatus);

  if (
    !canAutoAdvanceStatus(normalizedStatus) ||
    !earlyPartNeededStatuses.has(normalizedStatus)
  ) {
    return null;
  }

  if (isWorkOrderStatusWaitingForParts(normalizedStatus)) {
    return null;
  }

  return "parts_needed";
}

export function getWorkOrderStatusAfterPurchaseOrderCreated(currentStatus) {
  if (!canAutoAdvanceStatus(currentStatus)) {
    return null;
  }

  const normalizedStatus = normalizeStatus(currentStatus);

  if (normalizedStatus === "waiting_parts") {
    return null;
  }

  return "waiting_parts";
}

export function getWorkOrderStatusAfterWorkStarted(currentStatus) {
  const normalizedStatus = normalizeStatus(currentStatus);

  if (
    !normalizedStatus ||
    normalizedStatus === "needed" ||
    normalizedStatus === "approved"
  ) {
    return "in_progress";
  }

  return null;
}

function partIsReceived(part, purchaseOrderItems) {
  if (receivedPartStatuses.has(normalizeStatus(part?.status))) {
    return true;
  }

  const linkedItems = purchaseOrderItems.filter(
    (item) => item.part_request_id === part?.id
  );

  return (
    linkedItems.length > 0 &&
    linkedItems.every((item) =>
      receivedPartStatuses.has(normalizeStatus(item?.status))
    )
  );
}

export function getWorkOrderStatusAfterPartsReceived(
  currentStatus,
  { partRequests = [], purchaseOrderItems = [] } = {}
) {
  if (!isWorkOrderStatusWaitingForParts(currentStatus)) {
    return null;
  }

  const neededPurchaseParts = partRequests.filter(
    (part) =>
      part?.part_source === "needs_to_buy" &&
      part?.approval_status !== "rejected"
  );

  if (neededPurchaseParts.length === 0) {
    return null;
  }

  if (
    neededPurchaseParts.every((part) =>
      partIsReceived(part, purchaseOrderItems)
    )
  ) {
    return "in_progress";
  }

  return null;
}
