export const vehicleStatusOptions = [
  "inspection",
  "parts_needed",
  "waiting_for_parts",
  "repairing",
  "quality_check",
  "ready_for_sale",
  "sold",
  "archived",
];

const vehicleStatusLabels = {
  inspection: "Inspection",
  parts_needed: "Parts Needed",
  waiting_for_parts: "Waiting For Parts",
  repairing: "Repairing",
  quality_check: "Quality Check",
  ready_for_sale: "Ready For Sale",
  sold: "Sold",
  archived: "Archived",
};

export function formatVehicleStatus(status) {
  return vehicleStatusLabels[status] ?? "Not Available";
}

export function getVehicleStatusClassName(status) {
  if (status === "parts_needed" || status === "waiting_for_parts") {
    return "bg-amber-50 text-amber-800 ring-amber-200";
  }

  if (
    status === "inspection" ||
    status === "repairing" ||
    status === "quality_check"
  ) {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (status === "ready_for_sale" || status === "sold") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "archived") {
    return "bg-slate-100 text-slate-700 ring-slate-200";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
}
