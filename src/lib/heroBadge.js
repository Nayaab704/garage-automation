const badgeLabels = {
  approved: "Approved",
  archived: "Archived",
  blocked: "Blocked",
  cancelled: "Cancelled",
  clean: "Clean",
  completed: "Completed",
  flood: "Flood",
  in_progress: "In Progress",
  inspection: "Inspection",
  issue: "Issue",
  needs_attention: "Needs Attention",
  not_started: "Not Started",
  ordered: "Ordered",
  parts_needed: "Parts Needed",
  parts_review: "Parts Review",
  pending: "Pending",
  pending_review: "Pending",
  quality_check: "Quality Check",
  ready: "Ready",
  ready_for_parts_review: "Parts Review",
  ready_for_sale: "Ready",
  rebuilt: "Rebuilt",
  received: "Received",
  rejected: "Rejected",
  repairing: "Repairing",
  requested: "Requested",
  salvage: "Salvage",
  sold: "Sold",
  unavailable: "Unavailable",
  third_party: "3rd-Party",
  unknown: "Unknown",
  urgent: "Urgent",
  waiting_for_parts: "Waiting Parts",
  waiting_parts: "Waiting Parts",
};

const blueValues = new Set([
  "in_progress",
  "inspection",
  "ordered",
  "quality_check",
  "repairing",
]);

const greenValues = new Set([
  "approved",
  "clean",
  "completed",
  "ready",
  "ready_for_sale",
  "rebuilt",
  "received",
  "sold",
]);

const amberValues = new Set([
  "needs_attention",
  "parts_needed",
  "parts_review",
  "pending",
  "pending_review",
  "ready_for_parts_review",
  "requested",
  "waiting_for_parts",
  "waiting_parts",
]);

const redValues = new Set([
  "blocked",
  "cancelled",
  "flood",
  "issue",
  "rejected",
  "salvage",
  "urgent",
]);

const grayValues = new Set([
  "archived",
  "neutral",
  "not_started",
  "unavailable",
  "unknown",
]);

const variantClassNames = {
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  gray: "border-slate-200 bg-slate-100 text-slate-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  red: "border-red-200 bg-red-50 text-red-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

function normalizeBadgeValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function titleCase(value) {
  if (!value) {
    return "Unknown";
  }

  return String(value)
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatHeroBadgeLabel(value) {
  const normalizedValue = normalizeBadgeValue(value);
  return badgeLabels[normalizedValue] ?? titleCase(normalizedValue);
}

export function getHeroBadgeVariant(value) {
  const normalizedValue = normalizeBadgeValue(value);

  if (blueValues.has(normalizedValue)) {
    return "blue";
  }

  if (greenValues.has(normalizedValue)) {
    return "green";
  }

  if (amberValues.has(normalizedValue)) {
    return "amber";
  }

  if (redValues.has(normalizedValue)) {
    return "red";
  }

  if (grayValues.has(normalizedValue)) {
    return "gray";
  }

  return "gray";
}

export function getHeroBadgeClassName(valueOrVariant, className = "") {
  const variant =
    variantClassNames[valueOrVariant] !== undefined
      ? valueOrVariant
      : getHeroBadgeVariant(valueOrVariant);

  return `inline-flex h-7 max-w-[10.5rem] shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap ${variantClassNames[variant]} ${className}`;
}
