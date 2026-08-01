export const vehicleWorkflowStatuses = [
  "inspection",
  "repair",
  "quality_check",
  "ready_for_sale",
];

export const activeVehicleWorkflowStatuses = [
  "inspection",
  "repair",
  "quality_check",
];

export const vehicleStatusOptions = vehicleWorkflowStatuses;

export const vehicleStatusLabels = {
  inspection: "Inspection",
  quality_check: "Quality Check",
  ready_for_sale: "Ready for Sale",
  repair: "Repair",
};

const statusAliases = {
  archived: "ready_for_sale",
  in_progress: "repair",
  in_repair: "repair",
  inspection: "inspection",
  parts_needed: "repair",
  quality_check: "quality_check",
  qc: "quality_check",
  ready: "ready_for_sale",
  ready_for_sale: "ready_for_sale",
  repairing: "repair",
  repair: "repair",
  sold: "ready_for_sale",
  waiting_for_parts: "repair",
  waiting_parts: "repair",
};

const statusClassNames = {
  inspection: "bg-blue-50 text-blue-700 ring-blue-200",
  quality_check: "bg-violet-50 text-violet-700 ring-violet-200",
  ready_for_sale: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  repair: "bg-amber-50 text-amber-800 ring-amber-200",
};

function normalizeStatusValue(status) {
  return String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizeVehicleStatus(status) {
  const normalizedStatus = normalizeStatusValue(status);
  return statusAliases[normalizedStatus] ?? "inspection";
}

export function getVehicleWorkflowStatus(vehicleOrStatus) {
  return normalizeVehicleStatus(
    typeof vehicleOrStatus === "object"
      ? vehicleOrStatus?.status
      : vehicleOrStatus
  );
}

export function formatVehicleStatus(status) {
  return vehicleStatusLabels[normalizeVehicleStatus(status)] ?? "Inspection";
}

export function getVehicleStatusClassName(status) {
  return statusClassNames[normalizeVehicleStatus(status)];
}

export function getVehicleStatusBadge(status) {
  const normalizedStatus = normalizeVehicleStatus(status);

  return {
    className: getVehicleStatusClassName(normalizedStatus),
    label: formatVehicleStatus(normalizedStatus),
    status: normalizedStatus,
  };
}

export function isVehicleSold(vehicle, saleOrSales = null) {
  const saleStatus = normalizeStatusValue(vehicle?.sale_status);
  const legacyWorkflowStatus = normalizeStatusValue(vehicle?.status);
  const hasSaleRecord = Array.isArray(saleOrSales)
    ? saleOrSales.length > 0
    : Boolean(saleOrSales);

  return (
    saleStatus === "sold" ||
    legacyWorkflowStatus === "sold" ||
    hasSaleRecord
  );
}

export function isActiveVehicleStatus(status) {
  return activeVehicleWorkflowStatuses.includes(normalizeVehicleStatus(status));
}

export function isReadyForSaleStatus(status) {
  return normalizeVehicleStatus(status) === "ready_for_sale";
}

export function shouldMoveToRepair(vehicleOrStatus) {
  return normalizeVehicleStatus(
    typeof vehicleOrStatus === "object"
      ? vehicleOrStatus?.status
      : vehicleOrStatus
  ) === "inspection";
}

export function getFinalCheckState(finalChecks = [], finalCheckTemplates = []) {
  const checksByKey = new Map(
    finalChecks.map((finalCheck) => [finalCheck.check_key, finalCheck])
  );
  const completedCount = finalCheckTemplates.filter(
    (template) => checksByKey.get(template.check_key)?.is_checked === true
  ).length;
  const totalCount = finalCheckTemplates.length;

  return {
    completedCount,
    isComplete: totalCount > 0 && completedCount === totalCount,
    isStarted: completedCount > 0,
    totalCount,
  };
}

export function getVehicleStatusAfterFinalCheckChange({
  finalChecks = [],
  finalCheckTemplates = [],
  vehicle,
}) {
  const currentStatus = getVehicleWorkflowStatus(vehicle);
  const finalCheckState = getFinalCheckState(finalChecks, finalCheckTemplates);

  if (finalCheckState.isComplete) {
    return "ready_for_sale";
  }

  if (
    finalCheckState.isStarted &&
    ["inspection", "repair", "ready_for_sale"].includes(currentStatus)
  ) {
    return "quality_check";
  }

  return null;
}
