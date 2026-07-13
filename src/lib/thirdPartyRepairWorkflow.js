export const THIRD_PARTY_REPAIR_IN_PROGRESS_STATUS = "in_progress";
export const THIRD_PARTY_REPAIR_COMPLETE_STATUS = "completed";

export const thirdPartyRepairStatusLabels = {
  completed: "Complete",
  in_progress: "In Progress",
};

const completeStatusAliases = new Set([
  "cancelled",
  "closed",
  "complete",
  "completed",
  "done",
  "received",
  "returned",
]);

const inProgressStatusAliases = new Set([
  "",
  "active",
  "pending",
  "planned",
  "scheduled",
  "sent",
  "sent_out",
  "in_progress",
]);

function normalizeStatusValue(status) {
  return String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizeThirdPartyRepairStatus(status) {
  const normalizedStatus = normalizeStatusValue(status);

  if (completeStatusAliases.has(normalizedStatus)) {
    return THIRD_PARTY_REPAIR_COMPLETE_STATUS;
  }

  if (inProgressStatusAliases.has(normalizedStatus)) {
    return THIRD_PARTY_REPAIR_IN_PROGRESS_STATUS;
  }

  return THIRD_PARTY_REPAIR_IN_PROGRESS_STATUS;
}

export function formatThirdPartyRepairStatus(status) {
  return thirdPartyRepairStatusLabels[
    normalizeThirdPartyRepairStatus(status)
  ];
}

export function isThirdPartyRepairActive(thirdPartyRepairOrStatus) {
  return (
    normalizeThirdPartyRepairStatus(
      typeof thirdPartyRepairOrStatus === "object"
        ? thirdPartyRepairOrStatus?.status
        : thirdPartyRepairOrStatus
    ) === THIRD_PARTY_REPAIR_IN_PROGRESS_STATUS
  );
}

export function isThirdPartyRepairComplete(thirdPartyRepairOrStatus) {
  return (
    normalizeThirdPartyRepairStatus(
      typeof thirdPartyRepairOrStatus === "object"
        ? thirdPartyRepairOrStatus?.status
        : thirdPartyRepairOrStatus
    ) === THIRD_PARTY_REPAIR_COMPLETE_STATUS
  );
}

export function getThirdPartyRepairStatusBadge(status) {
  const normalizedStatus = normalizeThirdPartyRepairStatus(status);

  if (normalizedStatus === THIRD_PARTY_REPAIR_COMPLETE_STATUS) {
    return {
      className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      label: thirdPartyRepairStatusLabels.completed,
      status: normalizedStatus,
    };
  }

  return {
    className: "bg-violet-50 text-violet-700 ring-violet-200",
    label: thirdPartyRepairStatusLabels.in_progress,
    status: normalizedStatus,
  };
}
