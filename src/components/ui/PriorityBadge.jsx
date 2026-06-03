const priorityLabels = {
  high: "High",
  low: "Low",
  medium: "Medium",
  urgent: "Urgent",
};

function formatPriorityLabel(priority) {
  return priorityLabels[priority] ?? "Not Available";
}

function getPriorityBadgeClassName(priority) {
  if (priority === "urgent") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (priority === "high") {
    return "bg-orange-50 text-orange-700 ring-orange-200";
  }

  if (priority === "medium") {
    return "bg-amber-50 text-amber-800 ring-amber-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function PriorityBadge({ className = "", priority }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getPriorityBadgeClassName(
        priority
      )} ${className}`}
    >
      {formatPriorityLabel(priority)}
    </span>
  );
}

export default PriorityBadge;
