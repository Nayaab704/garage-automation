import { useEffect, useMemo, useState } from "react";
import AppIcon from "../components/ui/AppIcon";
import {
  getPartQueueCounts,
  isPartPendingReview,
} from "../lib/partWorkflowUtils";
import { getPurchaseOrderReturnDeduction } from "../lib/partReturns";
import { hasPermission } from "../lib/permissions";
import {
  getRepairQueueCounts,
  isRepairJobUrgent,
} from "../lib/repairWorkflowUtils";
import { supabase } from "../lib/supabaseClient";
import { isThirdPartyRepairActive } from "../lib/thirdPartyRepairWorkflow";
import { activePrebookingBadgeColumns } from "../lib/vehiclePrebookings";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US");

const openPurchaseOrderStatuses = ["ordered", "partial_received"];

const dashboardSections = [
  { key: "action_center", label: "Action Center" },
  { key: "operations", label: "Operations" },
  { key: "finance", label: "Finance" },
];

function numberOrZero(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatCurrency(value) {
  return currencyFormatter.format(numberOrZero(value));
}

function formatNumber(value) {
  return numberFormatter.format(numberOrZero(value));
}

function groupBy(records, key) {
  return records.reduce((groupedRecords, record) => {
    const groupKey = record?.[key];

    if (!groupKey) {
      return groupedRecords;
    }

    groupedRecords[groupKey] = [...(groupedRecords[groupKey] ?? []), record];
    return groupedRecords;
  }, {});
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatLabel(value, labels = {}) {
  if (labels[value]) {
    return labels[value];
  }

  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  return String(value)
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getVehicleName(vehicle) {
  if (!vehicle) {
    return "Vehicle not found";
  }

  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
}

function getVehicleLabel(vehicle) {
  if (!vehicle) {
    return "Vehicle not found";
  }

  const stockNumber = vehicle.stock_number || "No stock number";
  const vehicleName = getVehicleName(vehicle);

  return vehicleName ? `${stockNumber} - ${vehicleName}` : stockNumber;
}

function isSoldVehicle(vehicle, soldVehicleIds = new Set()) {
  return (
    soldVehicleIds.has(vehicle.id) ||
    vehicle.sale_status === "sold" ||
    String(vehicle.status ?? "").toLowerCase() === "sold"
  );
}

function isActiveVehicle(vehicle, soldVehicleIds = new Set()) {
  const status = String(vehicle.status ?? "").toLowerCase();
  return !isSoldVehicle(vehicle, soldVehicleIds) && status !== "archived";
}

function mergeVehiclesWithSummaries(
  vehicles,
  summaries,
  returnDeductionsByVehicleId = {}
) {
  const summariesByStockNumber = new Map(
    summaries.map((summary) => [summary.stock_number, summary])
  );

  return vehicles.map((vehicle) => {
    const summary = summariesByStockNumber.get(vehicle.stock_number) ?? {};
    const returnDeduction = numberOrZero(
      returnDeductionsByVehicleId[vehicle.id]
    );
    const totalInvested = Math.max(
      numberOrZero(summary.total_invested) - returnDeduction,
      0
    );

    return {
      ...vehicle,
      estimated_profit: numberOrZero(summary.estimated_profit) + returnDeduction,
      total_invested: totalInvested,
    };
  });
}

function getSalesTotal(sales) {
  return sales.reduce(
    (total, sale) => total + numberOrZero(sale.sale_price ?? sale.sold_price),
    0
  );
}

function enrichDashboardParts({
  partRequests,
  purchaseOrderItems,
  purchaseOrdersById,
}) {
  const itemsByPartRequestId = groupBy(purchaseOrderItems, "part_request_id");

  return partRequests.map((partRequest) => ({
    ...partRequest,
    purchaseOrderItems: (itemsByPartRequestId[partRequest.id] ?? []).map(
      (item) => ({
        ...item,
        purchaseOrder: purchaseOrdersById[item.purchase_order_id] ?? null,
      })
    ),
  }));
}

function getReturnDeductionsByVehicleId(purchaseOrderItems, purchaseOrdersById) {
  return purchaseOrderItems.reduce((deductionsByVehicleId, item) => {
    const vehicleId = purchaseOrdersById[item.purchase_order_id]?.vehicle_id;

    if (!vehicleId) {
      return deductionsByVehicleId;
    }

    return {
      ...deductionsByVehicleId,
      [vehicleId]:
        numberOrZero(deductionsByVehicleId[vehicleId]) +
        getPurchaseOrderReturnDeduction([item]),
    };
  }, {});
}

function enrichDashboardRepairJobs({ partRequests, repairJobs }) {
  const partsByRepairJobId = groupBy(partRequests, "repair_job_id");

  return repairJobs.map((repairJob) => ({
    ...repairJob,
    parts: partsByRepairJobId[repairJob.id] ?? [],
  }));
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value)
  );
}

function formatDetailKey(key) {
  return String(key)
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDetailValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "object") {
    return null;
  }

  if (isUuidLike(value)) {
    return null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return formatLabel(value);
}

function summarizeActivityDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return "No details recorded.";
  }

  const preferredKeys = [
    "title",
    "part_name",
    "service_rendered",
    "description",
    "file_name",
    "document_type",
    "work_order",
    "from",
    "to",
    "quantity",
    "amount",
    "cost_type",
  ];
  const detailKeys = [
    ...preferredKeys.filter((key) => Object.hasOwn(details, key)),
    ...Object.keys(details).filter((key) => !preferredKeys.includes(key)),
  ];

  const summaryParts = detailKeys
    .filter((key) => !String(key).toLowerCase().includes("id"))
    .map((key) => {
      const formattedValue = formatDetailValue(details[key]);

      if (!formattedValue) {
        return null;
      }

      return `${formatDetailKey(key)}: ${formattedValue}`;
    })
    .filter(Boolean)
    .slice(0, 3);

  return summaryParts.length > 0
    ? summaryParts.join(" - ")
    : "No details recorded.";
}

function formatCountPhrase(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

function createActionCenterGroups({
  partQueueCounts,
  partRequests,
  purchaseOrders,
  prebookingBadges = [],
  repairJobs,
  repairQueueCounts,
  thirdPartyRepairs,
  vehicles,
}) {
  const urgentWorkOrderCount = repairJobs.filter((repairJob) =>
    isRepairJobUrgent(repairJob)
  ).length;
  const blockedWorkOrderCount = repairJobs.filter(
    (repairJob) => repairJob.status === "blocked"
  ).length;
  const pendingPartReviewCount = partRequests.filter((partRequest) =>
    isPartPendingReview(partRequest)
  ).length;
  const openPurchaseOrderCount = purchaseOrders.filter((purchaseOrder) =>
    openPurchaseOrderStatuses.includes(purchaseOrder.status)
  ).length;
  const qualityCheckCount = vehicles.filter(
    (vehicle) => vehicle.status === "quality_check"
  ).length;
  const thirdPartyRepairCount = thirdPartyRepairs.filter(
    isThirdPartyRepairActive
  ).length;

  const groups = [
    {
      key: "critical",
      title: "Critical / Blocking",
      rows: [
        {
          actionText: "View Urgent",
          count: urgentWorkOrderCount,
          icon: "warning",
          label: "Urgent Work Orders",
          page: "Repairs",
          routeSearchParams: { tab: "urgent" },
          subtitle: `${formatCountPhrase(
            urgentWorkOrderCount,
            "high-priority work order"
          )} need attention.`,
          tone: "red",
        },
        {
          actionText: "View Waiting",
          count: repairQueueCounts.waiting_parts ?? 0,
          icon: "clock",
          label: "Waiting Parts Work Orders",
          page: "Repairs",
          routeSearchParams: { tab: "waiting_parts" },
          subtitle: "Repairs blocked by parts activity.",
          tone: "amber",
        },
        {
          actionText: "Review",
          count: blockedWorkOrderCount,
          icon: "wrench",
          label: "Blocked Work Orders",
          page: "Repairs",
          routeSearchParams: { search: "blocked" },
          subtitle: "Repair blockers that may stall delivery.",
          tone: "red",
        },
      ],
    },
    {
      key: "purchasing",
      title: "Purchasing",
      rows: [
        {
          actionText: "Create PO",
          count: partQueueCounts.needs_po ?? 0,
          icon: "parts",
          label: "Parts Need PO",
          page: "Parts",
          routeSearchParams: { tab: "needs_po" },
          subtitle: "Create purchase orders for pending parts.",
          tone: "amber",
        },
        {
          actionText: "Review POs",
          count: openPurchaseOrderCount,
          icon: "file",
          label: "Open Purchase Orders",
          page: "Purchase Orders",
          routeSearchParams: { tab: "ordered" },
          subtitle: "Ordered parts that still need receiving.",
          tone: "blue",
        },
      ],
    },
    {
      key: "review",
      title: "Review",
      rows: [
        {
          actionText: "Review",
          count: pendingPartReviewCount,
          icon: "parts",
          label: "Pending Part Reviews",
          page: "Parts",
          routeSearchParams: { tab: "pending_review" },
          subtitle: "Review requested parts before ordering.",
          tone: "purple",
        },
        {
          actionText: "Review",
          count: qualityCheckCount,
          icon: "checklist",
          label: "Quality Check Vehicles",
          page: "Vehicles",
          routeSearchParams: { status: "quality_check" },
          subtitle: "Vehicles waiting on final admin review.",
          tone: "blue",
        },
      ],
    },
    {
      key: "follow_up",
      title: "Follow Up",
      rows: [
        {
          actionText: "Follow Up",
          count: thirdPartyRepairCount,
          icon: "third-party",
          label: "Third-Party Repairs Out",
          page: "Vehicles",
          routeSearchParams: { thirdParty: "1" },
          subtitle: "Follow up on outside repair work.",
          tone: "teal",
        },
        {
          actionText: "View",
          count: prebookingBadges.length,
          icon: "dollar",
          label: "Prebooked Vehicles",
          page: "Vehicles",
          routeSearchParams: { prebooked: "1" },
          subtitle: "Reservations attached to inventory vehicles.",
          tone: "purple",
        },
      ],
    },
  ];

  return groups.map((group) => ({
    ...group,
    rows: group.rows.filter((row) => numberOrZero(row.count) > 0),
  }));
}

async function fetchDashboardData() {
  const [
    summariesResponse,
    vehiclesResponse,
    salesResponse,
    partRequestsResponse,
    repairJobsResponse,
    purchaseOrdersResponse,
    purchaseOrderItemsResponse,
    thirdPartyRepairsResponse,
    prebookingBadgesResponse,
    activityLogsResponse,
    laborLogsResponse,
    profilesResponse,
  ] = await Promise.all([
    supabase
      .from("vehicle_investment_summary")
      .select("stock_number, make, model, total_invested, estimated_profit")
      .order("stock_number", { ascending: true }),
    supabase
      .from("vehicles")
      .select(
        "id, stock_number, year, make, model, status, sale_status, created_at"
      )
      .order("stock_number", { ascending: true }),
    supabase
      .from("sales")
      .select("id, vehicle_id, sale_price, sale_date")
      .order("sale_date", { ascending: false }),
    supabase
      .from("part_requests")
      .select(
        "id, vehicle_id, repair_job_id, part_name, quantity, status, part_source, approval_status, unit_cost, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("repair_jobs")
      .select("id, vehicle_id, title, priority, status, notes, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("purchase_orders")
      .select("id, vehicle_id, status, ordered_at, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("purchase_order_items")
      .select(
        "id, purchase_order_id, part_request_id, quantity, unit_cost, shipping_cost, tax, status, return_status, returned_amount, returned_shipping_amount"
      ),
    supabase
      .from("third_party_repairs")
      .select(
        "id, vehicle_id, repair_job_id, service_rendered, status, outbound_date, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("active_vehicle_prebooking_badges")
      .select(activePrebookingBadgeColumns),
    supabase
      .from("activity_logs")
      .select("id, vehicle_id, action, details, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("labor_logs")
      .select("id, vehicle_id, technician_id, hours, created_at")
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("profiles")
      .select("id, full_name, email, role, hourly_rate, is_active")
      .order("full_name", { ascending: true }),
  ]);

  const firstRequiredError =
    summariesResponse.error ??
    vehiclesResponse.error ??
    salesResponse.error ??
    partRequestsResponse.error ??
    repairJobsResponse.error ??
    purchaseOrdersResponse.error ??
    purchaseOrderItemsResponse.error ??
    thirdPartyRepairsResponse.error ??
    prebookingBadgesResponse.error;

  if (firstRequiredError) {
    return { data: null, error: firstRequiredError };
  }

  const purchaseOrders = purchaseOrdersResponse.data ?? [];
  const purchaseOrderItems = purchaseOrderItemsResponse.data ?? [];
  const purchaseOrdersById = Object.fromEntries(
    purchaseOrders.map((purchaseOrder) => [purchaseOrder.id, purchaseOrder])
  );
  const partRequests = enrichDashboardParts({
    partRequests: partRequestsResponse.data ?? [],
    purchaseOrderItems,
    purchaseOrdersById,
  });
  const repairJobs = enrichDashboardRepairJobs({
    partRequests,
    repairJobs: repairJobsResponse.data ?? [],
  });
  const returnDeductionsByVehicleId = getReturnDeductionsByVehicleId(
    purchaseOrderItems,
    purchaseOrdersById
  );

  return {
    data: {
      activityLogs: activityLogsResponse.error
        ? []
        : activityLogsResponse.data ?? [],
      investmentSummaries: summariesResponse.data ?? [],
      laborLogs: laborLogsResponse.error ? [] : laborLogsResponse.data ?? [],
      partRequests,
      profiles: profilesResponse.error ? [] : profilesResponse.data ?? [],
      purchaseOrders,
      prebookingBadges: prebookingBadgesResponse.data ?? [],
      repairJobs,
      sales: salesResponse.data ?? [],
      thirdPartyRepairs: thirdPartyRepairsResponse.data ?? [],
      returnDeductionsByVehicleId,
      vehicles: vehiclesResponse.data ?? [],
    },
    error: null,
  };
}

const toneClassNames = {
  amber: {
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    icon: "bg-amber-50 text-amber-700",
  },
  blue: {
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    icon: "bg-blue-50 text-blue-700",
  },
  gray: {
    badge: "border-slate-200 bg-slate-100 text-slate-700",
    icon: "bg-slate-100 text-slate-600",
  },
  green: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: "bg-emerald-50 text-emerald-700",
  },
  purple: {
    badge: "border-violet-200 bg-violet-50 text-violet-700",
    icon: "bg-violet-50 text-violet-700",
  },
  red: {
    badge: "border-red-200 bg-red-50 text-red-700",
    icon: "bg-red-50 text-red-700",
  },
  teal: {
    badge: "border-teal-200 bg-teal-50 text-teal-700",
    icon: "bg-teal-50 text-teal-700",
  },
};

function getToneClasses(tone) {
  return toneClassNames[tone] ?? toneClassNames.gray;
}

function DashboardSection({ children, className = "", title }) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div className="border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <h2 className="truncate text-sm font-black text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SummaryCard({
  helperText,
  icon,
  label,
  value,
  valueClassName = "text-slate-950",
}) {
  return (
    <article className="flex min-h-[4.75rem] min-w-0 items-start gap-2.5 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm sm:min-h-20 sm:p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100 sm:h-9 sm:w-9">
        <AppIcon name={icon} size={18} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[0.65rem] font-black uppercase text-slate-500 sm:text-[0.68rem]">
          {label}
        </p>
        <p
          className={`mt-0.5 truncate text-base font-black leading-tight tabular-nums sm:text-xl ${valueClassName}`}
        >
          {value}
        </p>
        {helperText && (
          <p className="mt-0.5 truncate text-[0.7rem] leading-4 text-slate-500 sm:text-xs">
            {helperText}
          </p>
        )}
      </div>
    </article>
  );
}

function DashboardQuickActions({ canStartIntake, onNavigate }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-black uppercase text-blue-700">
            Admin Command Center
          </p>
          <h1 className="mt-0.5 truncate text-xl font-black text-slate-950 sm:text-2xl">
            Dashboard
          </h1>
        </div>

        {canStartIntake && (
          <button
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-[0_12px_24px_rgba(37,99,235,0.2)] transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-auto"
            onClick={() => onNavigate?.("Intake")}
            type="button"
          >
            <AppIcon name="plus" size={18} />
            New Vehicle
          </button>
        )}
      </div>
    </section>
  );
}

function ActionCenterRow({ row, onNavigate }) {
  const toneClasses = getToneClasses(row.tone);

  return (
    <button
      className="grid min-h-16 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-4"
      onClick={() => onNavigate?.(row.page, row.routeSearchParams)}
      type="button"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClasses.icon}`}
      >
        <AppIcon name={row.icon} size={18} />
      </span>

      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-slate-950">
          {row.label}
        </span>
        <span className="mt-0.5 block truncate text-xs leading-5 text-slate-500">
          {row.subtitle}
        </span>
      </span>

      <span className="col-start-2 flex min-w-0 items-center gap-2 sm:col-start-auto sm:justify-end">
        <span
          className={`inline-flex min-w-8 shrink-0 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-black tabular-nums ${toneClasses.badge}`}
        >
          {formatNumber(row.count)}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600 shadow-sm">
          {row.actionText}
          <AppIcon className="text-slate-400" name="chevron-right" size={15} />
        </span>
      </span>
    </button>
  );
}

function ActionCenterGroup({ group, onNavigate }) {
  const groupCount = group.rows.reduce(
    (total, row) => total + numberOrZero(row.count),
    0
  );

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <h2 className="truncate text-sm font-black text-slate-950">
          {group.title}
        </h2>
        <span className="inline-flex min-w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black tabular-nums text-slate-600">
          {formatNumber(groupCount)}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {group.rows.map((row) => (
          <ActionCenterRow
            key={row.label}
            onNavigate={onNavigate}
            row={row}
          />
        ))}
      </div>
    </section>
  );
}

function DashboardActionCenterPanel({ actionGroups, onNavigate }) {
  const visibleGroups = actionGroups.filter((group) => group.rows.length > 0);

  if (visibleGroups.length === 0) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <AppIcon name="check" size={22} />
        </span>
        <h2 className="mt-3 text-lg font-black text-slate-950">
          All clear. No urgent actions right now.
        </h2>
      </section>
    );
  }

  return (
    <div className="grid min-w-0 gap-3 xl:grid-cols-2">
      {visibleGroups.map((group) => (
        <ActionCenterGroup
          group={group}
          key={group.key}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

function DashboardSectionSwitcher({ activeSection, counts = {}, onChange }) {
  return (
    <nav
      aria-label="Dashboard sections"
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
    >
      <div className="grid grid-cols-3 gap-1">
        {dashboardSections.map((section) => {
          const isActive = activeSection === section.key;
          const count = counts[section.key];

          return (
            <button
              aria-pressed={isActive}
              className={`flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:text-sm ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
              key={section.key}
              onClick={() => onChange?.(section.key)}
              type="button"
            >
              <span className="truncate">{section.label}</span>
              {count !== undefined && (
                <span
                  className={`inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-black tabular-nums ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {formatNumber(count)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function DashboardActionRow({
  helperText,
  icon,
  label,
  onClick,
  tone = "gray",
  value,
}) {
  const toneClasses = getToneClasses(tone);
  const rowContent = (
    <>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${toneClasses.icon}`}
      >
        <AppIcon name={icon} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-slate-950">
          {label}
        </span>
        {helperText && (
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {helperText}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span
          className={`inline-flex min-w-8 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-black tabular-nums ${toneClasses.badge}`}
        >
          {value}
        </span>
        {onClick && (
          <AppIcon
            className="text-slate-400"
            name="chevron-right"
            size={17}
          />
        )}
      </span>
    </>
  );

  if (!onClick) {
    return (
      <div className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2.5 sm:px-4">
        {rowContent}
      </div>
    );
  }

  return (
    <button
      className="grid min-h-14 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:px-4"
      onClick={onClick}
      type="button"
    >
      {rowContent}
    </button>
  );
}

function DashboardOverviewPanel({
  activeVehiclesCount,
  laborLogs,
  openPurchaseOrderCount,
  openRepairJobsCount,
  partQueueCounts,
  profiles,
  qualityCheckCount,
  readyForSaleCount,
  recentActivityLogs,
  repairQueueCounts,
  vehiclesById,
  onNavigate,
}) {
  const operationsRows = [
    {
      helperText: "Vehicles not sold or archived",
      icon: "car",
      label: "Active Inventory",
      page: "Vehicles",
      tone: "green",
      value: formatNumber(activeVehiclesCount),
    },
    {
      helperText: "Open service work",
      icon: "wrench",
      label: "Repair Work",
      page: "Repairs",
      tone: "amber",
      value: formatNumber(openRepairJobsCount),
    },
    {
      helperText: "Ready for purchase orders",
      icon: "parts",
      label: "Parts Need PO",
      page: "Parts",
      tone: "amber",
      value: formatNumber(partQueueCounts.needs_po ?? 0),
    },
    {
      helperText: "Ordered or partially received",
      icon: "file",
      label: "Open Purchase Orders",
      page: "Purchase Orders",
      tone: "blue",
      value: formatNumber(openPurchaseOrderCount),
    },
    {
      helperText: "Work blocked by part movement",
      icon: "clock",
      label: "Waiting Parts",
      page: "Repairs",
      tone: "amber",
      value: formatNumber(repairQueueCounts.waiting_parts ?? 0),
    },
    {
      helperText: "Final review before sale",
      icon: "status",
      label: "Quality Check",
      page: "Vehicles",
      tone: "blue",
      value: formatNumber(qualityCheckCount),
    },
    {
      helperText: "Available after final checks",
      icon: "check",
      label: "Ready for Sale",
      page: "Vehicles",
      tone: "green",
      value: formatNumber(readyForSaleCount),
    },
  ];

  return (
    <div className="grid min-w-0 gap-3 xl:grid-cols-[0.9fr_1.1fr]">
      <DashboardSection title="Operations Snapshot">
        <div className="divide-y divide-slate-100">
          {operationsRows.map((row) => (
            <DashboardActionRow
              helperText={row.helperText}
              icon={row.icon}
              key={row.label}
              label={row.label}
              onClick={() => onNavigate?.(row.page)}
              tone={row.tone}
              value={row.value}
            />
          ))}
        </div>
      </DashboardSection>

      <div className="grid min-w-0 gap-3">
        <RecentActivity
          activityLogs={recentActivityLogs}
          vehiclesById={vehiclesById}
        />
        <TeamActivitySection
          laborLogs={laborLogs}
          profiles={profiles}
          vehiclesById={vehiclesById}
        />
      </div>
    </div>
  );
}

function DashboardFinancePanel({
  activeInventoryInvestment,
  activeVehiclesCount,
  averageActiveInvestment,
  estimatedActiveProfit,
  prebookedVehiclesCount,
  readyForSaleCount,
  soldRevenue,
  soldVehiclesCount,
}) {
  return (
    <div className="grid min-w-0 gap-3 xl:grid-cols-[1.2fr_0.8fr]">
      <DashboardSection title="Finance Overview">
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
          <SummaryCard
            helperText={`${formatNumber(activeVehiclesCount)} active`}
            icon="dollar"
            label="Active Investment"
            value={formatCurrency(activeInventoryInvestment)}
          />
          <SummaryCard
            helperText="Active vehicles"
            icon="chart-up"
            label="Estimated Profit"
            value={formatCurrency(estimatedActiveProfit)}
            valueClassName={
              estimatedActiveProfit < 0 ? "text-red-700" : "text-emerald-700"
            }
          />
          <SummaryCard
            helperText={`${formatNumber(soldVehiclesCount)} sold`}
            icon="dollar"
            label="Sold Revenue"
            value={formatCurrency(soldRevenue)}
            valueClassName="text-emerald-700"
          />
          <SummaryCard
            helperText="Per active vehicle"
            icon="car"
            label="Avg Investment"
            value={formatCurrency(averageActiveInvestment)}
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Sales Snapshot">
        <div className="divide-y divide-slate-100">
          <DashboardActionRow
            helperText="Closed sales"
            icon="check"
            label="Sold Vehicles"
            tone="green"
            value={formatNumber(soldVehiclesCount)}
          />
          <DashboardActionRow
            helperText="Total sale revenue"
            icon="dollar"
            label="Sold Revenue"
            tone="green"
            value={formatCurrency(soldRevenue)}
          />
          <DashboardActionRow
            helperText="Projected active upside"
            icon="chart-up"
            label="Estimated Profit"
            tone={estimatedActiveProfit < 0 ? "red" : "green"}
            value={formatCurrency(estimatedActiveProfit)}
          />
          <DashboardActionRow
            helperText="Available to sell"
            icon="check"
            label="Ready for Sale"
            tone="green"
            value={formatNumber(readyForSaleCount)}
          />
          <DashboardActionRow
            helperText="Reservations attached"
            icon="dollar"
            label="Prebooked Vehicles"
            tone="purple"
            value={formatNumber(prebookedVehiclesCount)}
          />
        </div>
      </DashboardSection>
    </div>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-600 shadow-sm">
        Loading dashboard...
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="h-[4.75rem] animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm"
            key={index}
          />
        ))}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="h-4 w-36 rounded-full bg-slate-200" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              className="h-14 animate-pulse rounded-xl bg-slate-100"
              key={index}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function RecentActivity({ activityLogs, vehiclesById }) {
  const visibleActivityLogs = activityLogs.slice(0, 5);

  return (
    <DashboardSection title="Recent Activity">
      {visibleActivityLogs.length === 0 ? (
        <div className="m-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          No recent activity found yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {visibleActivityLogs.map((activityLog) => (
            <div
              className="flex min-w-0 items-start gap-2.5 px-3 py-2.5 sm:px-4"
              key={activityLog.id}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <AppIcon name="status" size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-950">
                      {activityLog.action}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {getVehicleLabel(vehiclesById[activityLog.vehicle_id])}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-slate-400">
                    {formatDate(activityLog.created_at)}
                  </p>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                  {summarizeActivityDetails(activityLog.details)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}

function getProfileDisplayName(profile) {
  return profile?.full_name || profile?.email || "Team member";
}

function buildTeamTodayRows(laborLogs, profilesById) {
  const rowsByTechnician = laborLogs.reduce((rows, laborLog) => {
    const technicianId = laborLog.technician_id || "unknown";
    const currentRow = rows[technicianId] ?? {
      hours: 0,
      profile: profilesById[technicianId] ?? null,
      vehicleIds: new Set(),
    };

    currentRow.hours += numberOrZero(laborLog.hours);

    if (laborLog.vehicle_id) {
      currentRow.vehicleIds.add(laborLog.vehicle_id);
    }

    rows[technicianId] = currentRow;
    return rows;
  }, {});

  return Object.entries(rowsByTechnician)
    .map(([technicianId, row]) => ({
      hours: row.hours,
      id: technicianId,
      name: getProfileDisplayName(row.profile),
      vehicleCount: row.vehicleIds.size,
    }))
    .sort((firstRow, secondRow) => secondRow.hours - firstRow.hours)
    .slice(0, 4);
}

function TeamActivitySection({ laborLogs, profiles, vehiclesById }) {
  const profilesById = Object.fromEntries(
    profiles.map((profile) => [profile.id, profile])
  );
  const teamRows = buildTeamTodayRows(laborLogs, profilesById);
  const totalHours = laborLogs.reduce(
    (total, laborLog) => total + numberOrZero(laborLog.hours),
    0
  );
  const missingRateCount = profiles.filter(
    (profile) =>
      profile.is_active &&
      profile.role === "technician" &&
      numberOrZero(profile.hourly_rate) <= 0
  ).length;
  const recentLaborLogs = laborLogs.slice(0, 3);

  return (
    <DashboardSection title="Team Today">
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
          <p className="text-[0.65rem] font-black uppercase text-slate-500">
            Labor Hours
          </p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-slate-950">
            {formatNumber(totalHours)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
          <p className="text-[0.65rem] font-black uppercase text-slate-500">
            Active Techs
          </p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-slate-950">
            {formatNumber(teamRows.length)}
          </p>
        </div>
      </div>

      {missingRateCount > 0 && (
        <div className="mx-3 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {formatNumber(missingRateCount)} technician
          {missingRateCount === 1 ? "" : "s"} need hourly rate setup.
        </div>
      )}

      {teamRows.length === 0 ? (
        <div className="mx-3 mb-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
          No labor logged today.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {teamRows.map((row) => (
            <div
              className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4"
              key={row.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-950">
                  {row.name}
                </p>
                <p className="text-xs text-slate-500">
                  {formatNumber(row.vehicleCount)} vehicle
                  {row.vehicleCount === 1 ? "" : "s"}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black tabular-nums text-blue-700 ring-1 ring-inset ring-blue-200">
                {formatNumber(row.hours)}h
              </span>
            </div>
          ))}
        </div>
      )}

      {recentLaborLogs.length > 0 && (
        <div className="border-t border-slate-100 px-3 py-2.5 sm:px-4">
          <p className="mb-2 text-[0.65rem] font-black uppercase text-slate-400">
            Recent Labor
          </p>
          <div className="space-y-1.5">
            {recentLaborLogs.map((laborLog) => {
              const profile = profilesById[laborLog.technician_id];

              return (
                <p
                  className="truncate text-xs font-semibold text-slate-600"
                  key={laborLog.id}
                >
                  {getProfileDisplayName(profile)} -{" "}
                  {formatNumber(laborLog.hours)}h -{" "}
                  {getVehicleLabel(vehiclesById[laborLog.vehicle_id])}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </DashboardSection>
  );
}

function Dashboard({
  currentProfile,
  onNavigate,
}) {
  const [activityLogs, setActivityLogs] = useState([]);
  const [investmentSummaries, setInvestmentSummaries] = useState([]);
  const [laborLogs, setLaborLogs] = useState([]);
  const [partRequests, setPartRequests] = useState([]);
  const [prebookingBadges, setPrebookingBadges] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [repairJobs, setRepairJobs] = useState([]);
  const [returnDeductionsByVehicleId, setReturnDeductionsByVehicleId] =
    useState({});
  const [sales, setSales] = useState([]);
  const [thirdPartyRepairs, setThirdPartyRepairs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [activeDashboardSection, setActiveDashboardSection] =
    useState("action_center");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const canViewDashboard = hasPermission(
    currentProfile?.role,
    "dashboard:view"
  );
  const canStartIntake = hasPermission(currentProfile?.role, "vehicle:create");

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data, error } = await fetchDashboardData();

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("Failed to load dashboard data", error);
          setErrorMessage("Could not refresh dashboard.");
          setActivityLogs([]);
          setInvestmentSummaries([]);
          setLaborLogs([]);
          setPartRequests([]);
          setPrebookingBadges([]);
          setProfiles([]);
          setPurchaseOrders([]);
          setRepairJobs([]);
          setReturnDeductionsByVehicleId({});
          setSales([]);
          setThirdPartyRepairs([]);
          setVehicles([]);
          return;
        }

        setActivityLogs(data.activityLogs);
        setInvestmentSummaries(data.investmentSummaries);
        setLaborLogs(data.laborLogs);
        setPartRequests(data.partRequests);
        setPrebookingBadges(data.prebookingBadges);
        setProfiles(data.profiles);
        setPurchaseOrders(data.purchaseOrders);
        setRepairJobs(data.repairJobs);
        setReturnDeductionsByVehicleId(data.returnDeductionsByVehicleId);
        setSales(data.sales);
        setThirdPartyRepairs(data.thirdPartyRepairs);
        setVehicles(data.vehicles);
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load dashboard data", error);
          setErrorMessage("Could not refresh dashboard.");
          setActivityLogs([]);
          setInvestmentSummaries([]);
          setLaborLogs([]);
          setPartRequests([]);
          setPrebookingBadges([]);
          setProfiles([]);
          setPurchaseOrders([]);
          setRepairJobs([]);
          setReturnDeductionsByVehicleId({});
          setSales([]);
          setThirdPartyRepairs([]);
          setVehicles([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if (canViewDashboard) {
      loadDashboardData();
    }

    return () => {
      isMounted = false;
    };
  }, [canViewDashboard]);

  const vehiclesById = useMemo(() => {
    return Object.fromEntries(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  }, [vehicles]);
  const soldVehicleIds = useMemo(() => {
    return new Set(sales.map((sale) => sale.vehicle_id).filter(Boolean));
  }, [sales]);

  const activeVehicles = vehicles.filter((vehicle) =>
    isActiveVehicle(vehicle, soldVehicleIds)
  );
  const soldVehicles = vehicles.filter((vehicle) =>
    isSoldVehicle(vehicle, soldVehicleIds)
  );
  const soldVehiclesCount = soldVehicleIds.size || soldVehicles.length;
  const activeInvestmentRows = mergeVehiclesWithSummaries(
    vehicles,
    investmentSummaries,
    returnDeductionsByVehicleId
  ).filter((vehicle) => isActiveVehicle(vehicle, soldVehicleIds));
  const activeInventoryInvestment = activeInvestmentRows.reduce(
    (total, vehicle) => total + numberOrZero(vehicle.total_invested),
    0
  );
  const estimatedActiveProfit = activeInvestmentRows.reduce(
    (total, vehicle) => total + numberOrZero(vehicle.estimated_profit),
    0
  );
  const soldRevenue = getSalesTotal(sales);
  const partQueueCounts = getPartQueueCounts(partRequests);
  const repairQueueCounts = getRepairQueueCounts(repairJobs);
  const openPurchaseOrderCount = purchaseOrders.filter((purchaseOrder) =>
    openPurchaseOrderStatuses.includes(purchaseOrder.status)
  ).length;
  const openRepairJobsCount = repairJobs.filter(
    (repairJob) =>
      repairJob.status !== "completed" && repairJob.status !== "cancelled"
  ).length;
  const qualityCheckCount = vehicles.filter(
    (vehicle) => vehicle.status === "quality_check"
  ).length;
  const readyForSaleCount = vehicles.filter(
    (vehicle) =>
      vehicle.status === "ready_for_sale" &&
      !isSoldVehicle(vehicle, soldVehicleIds)
  ).length;
  const averageActiveInvestment =
    activeVehicles.length > 0
      ? activeInventoryInvestment / activeVehicles.length
      : 0;
  const actionGroups = createActionCenterGroups({
    partQueueCounts,
    partRequests,
    prebookingBadges,
    purchaseOrders,
    repairJobs,
    repairQueueCounts,
    thirdPartyRepairs,
    vehicles,
  });
  const totalActionCount = actionGroups.reduce(
    (groupTotal, group) =>
      groupTotal +
      group.rows.reduce((rowTotal, row) => rowTotal + numberOrZero(row.count), 0),
    0
  );

  if (!canViewDashboard) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
        You do not have permission to view the dashboard.
      </section>
    );
  }

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <DashboardQuickActions
        canStartIntake={canStartIntake}
        onNavigate={onNavigate}
      />

      {isLoading && (
        <DashboardLoadingState />
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm">
          <h2 className="font-semibold">Unable to load dashboard data</h2>
          <p className="mt-2 text-sm">{errorMessage}</p>
        </section>
      )}

      {!isLoading && !errorMessage && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <SummaryCard
              helperText="All records"
              icon="car"
              label="Total Vehicles"
              value={formatNumber(vehicles.length)}
            />
            <SummaryCard
              helperText="Not sold or archived"
              icon="chart-up"
              label="Active Inventory"
              value={formatNumber(activeVehicles.length)}
            />
            <SummaryCard
              helperText="Active vehicles"
              icon="dollar"
              label="Active Investment"
              value={formatCurrency(activeInventoryInvestment)}
            />
            <SummaryCard
              helperText="Active vehicles"
              icon="chart-up"
              label="Estimated Profit"
              value={formatCurrency(estimatedActiveProfit)}
              valueClassName={
                estimatedActiveProfit < 0 ? "text-red-700" : "text-emerald-700"
              }
            />
            <SummaryCard
              helperText="Closed sales"
              icon="check"
              label="Sold Vehicles"
              value={formatNumber(soldVehiclesCount)}
            />
            <SummaryCard
              helperText="Sale revenue"
              icon="dollar"
              label="Sold Revenue"
              value={formatCurrency(soldRevenue)}
              valueClassName="text-emerald-700"
            />
          </section>

          <DashboardSectionSwitcher
            activeSection={activeDashboardSection}
            counts={{ action_center: totalActionCount }}
            onChange={setActiveDashboardSection}
          />

          {activeDashboardSection === "operations" && (
            <DashboardOverviewPanel
              activeVehiclesCount={activeVehicles.length}
              laborLogs={laborLogs}
              openPurchaseOrderCount={openPurchaseOrderCount}
              openRepairJobsCount={openRepairJobsCount}
              partQueueCounts={partQueueCounts}
              profiles={profiles}
              qualityCheckCount={qualityCheckCount}
              readyForSaleCount={readyForSaleCount}
              recentActivityLogs={activityLogs}
              repairQueueCounts={repairQueueCounts}
              vehiclesById={vehiclesById}
              onNavigate={onNavigate}
            />
          )}

          {activeDashboardSection === "action_center" && (
            <DashboardActionCenterPanel
              actionGroups={actionGroups}
              onNavigate={onNavigate}
            />
          )}

          {activeDashboardSection === "finance" && (
            <DashboardFinancePanel
              activeInventoryInvestment={activeInventoryInvestment}
              activeVehiclesCount={activeVehicles.length}
              averageActiveInvestment={averageActiveInvestment}
              estimatedActiveProfit={estimatedActiveProfit}
              prebookedVehiclesCount={prebookingBadges.length}
              readyForSaleCount={readyForSaleCount}
              soldRevenue={soldRevenue}
              soldVehiclesCount={soldVehiclesCount}
            />
          )}

          {vehicles.length === 0 && investmentSummaries.length === 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                No vehicles yet.
              </h2>
              <p className="mt-2 text-slate-600">
                Start by creating a new vehicle.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;
