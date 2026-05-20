export const repairProcessTypeOptions = [
  { label: "In-House Repair", value: "in_house" },
  { label: "Third-Party Repair", value: "third_party" },
  { label: "Parts & Accessories", value: "parts_accessories" },
];

export const repairProcessStatusOptions = [
  { label: "Not Started", value: "not_started" },
  { label: "In Progress", value: "in_progress" },
  { label: "Waiting", value: "waiting" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

export const repairProcessItemStatusOptions = [
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const repairProcessTypeLabels = {
  in_house: "In-House Repair",
  third_party: "Third-Party Repair",
  parts_accessories: "Parts & Accessories",
};

const repairProcessStatusLabels = {
  not_started: "Not Started",
  in_progress: "In Progress",
  waiting: "Waiting",
  completed: "Completed",
  cancelled: "Cancelled",
};

const repairProcessItemStatusLabels = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function formatRepairProcessType(processType) {
  return repairProcessTypeLabels[processType] ?? "Unknown Process";
}

export function formatRepairProcessStatus(status) {
  return repairProcessStatusLabels[status] ?? "Unknown Status";
}

export function formatRepairProcessItemStatus(status) {
  return repairProcessItemStatusLabels[status] ?? "Unknown Status";
}

export function getRepairProcessTypeClassName(processType) {
  if (processType === "in_house") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (processType === "third_party") {
    return "bg-violet-50 text-violet-700 ring-violet-200";
  }

  if (processType === "parts_accessories") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

export function getRepairProcessItemStatusClassName(status) {
  if (status === "completed") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "in_progress") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

export function getRepairProcessStatusClassName(status) {
  if (status === "completed") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "in_progress") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (status === "waiting") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}
