const statusLabels = {
  approved: "Approved",
  archived: "Archived",
  blocked: "Blocked",
  cancelled: "Cancelled",
  completed: "Completed",
  in_progress: "In Progress",
  inspection: "Inspection",
  installed: "Installed",
  needed: "Needed",
  not_required: "Not Required",
  ordered: "Ordered",
  parts_needed: "Parts Needed",
  pending: "Pending Review",
  prebooked: "Prebooked",
  quality_check: "Quality Check",
  ready_for_sale: "Ready For Sale",
  received: "Received",
  rejected: "Rejected",
  repair: "Repair",
  repairing: "Repairing",
  requested: "Requested",
  returned: "Returned",
  sold: "Sold",
  in_house: "In-House",
  waiting_for_parts: "Waiting For Parts",
  waiting_parts: "Waiting Parts",
};

const amberStatuses = new Set([
  "pending",
  "parts_needed",
  "repair",
  "requested",
  "waiting_for_parts",
  "waiting_parts",
]);

const greenStatuses = new Set([
  "approved",
  "completed",
  "installed",
  "not_required",
  "ready_for_sale",
  "received",
  "sold",
]);

const redStatuses = new Set([
  "archived",
  "blocked",
  "cancelled",
  "rejected",
  "returned",
  "urgent",
]);

const blueStatuses = new Set([
  "in_progress",
  "inspection",
  "ordered",
  "repairing",
]);

const purpleStatuses = new Set(["prebooked", "quality_check", "third_party"]);

const tealStatuses = new Set(["in_house"]);

function formatStatusLabel(status) {
  if (statusLabels[status]) {
    return statusLabels[status];
  }

  if (!status) {
    return "Not Available";
  }

  return String(status)
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getStatusBadgeClassName(status) {
  if (redStatuses.has(status)) {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (amberStatuses.has(status)) {
    return "bg-amber-50 text-amber-800 ring-amber-200";
  }

  if (greenStatuses.has(status)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (blueStatuses.has(status)) {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (purpleStatuses.has(status)) {
    return "bg-violet-50 text-violet-700 ring-violet-200";
  }

  if (tealStatuses.has(status)) {
    return "bg-teal-50 text-teal-700 ring-teal-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function StatusBadge({ className = "", label, status }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusBadgeClassName(
        status
      )} ${className}`}
    >
      {label ?? formatStatusLabel(status)}
    </span>
  );
}

export default StatusBadge;
