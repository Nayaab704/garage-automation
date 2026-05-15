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
    return "bg-yellow-50 text-yellow-800 ring-yellow-200";
  }

  if (status === "repairing" || status === "quality_check") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (status === "ready_for_sale" || status === "sold") {
    return "bg-green-50 text-green-700 ring-green-200";
  }

  if (status === "archived") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}
