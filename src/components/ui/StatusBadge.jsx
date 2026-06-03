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
  quality_check: "Quality Check",
  ready_for_sale: "Ready For Sale",
  received: "Received",
  rejected: "Rejected",
  repairing: "Repairing",
  requested: "Requested",
  sold: "Sold",
  waiting_for_parts: "Waiting For Parts",
  waiting_parts: "Waiting Parts",
};

const amberStatuses = new Set([
  "pending",
  "parts_needed",
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
  "urgent",
]);

const blueStatuses = new Set([
  "in_progress",
  "ordered",
  "quality_check",
  "repairing",
]);

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
