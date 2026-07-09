import { useEffect, useMemo, useState } from "react";
import AppIcon from "../components/ui/AppIcon";
import {
  getPartQueueCounts,
  isPartIssue,
  isPartNeedsPo,
  isPartPendingReview,
} from "../lib/partWorkflowUtils";
import { getPurchaseOrderReturnDeduction } from "../lib/partReturns";
import { hasPermission } from "../lib/permissions";
import {
  getRepairQueueCounts,
  isRepairJobUrgent,
  isRepairJobWaitingParts,
} from "../lib/repairWorkflowUtils";
import { supabase } from "../lib/supabaseClient";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US");

const workOrderStatusLabels = {
  approved: "Approved",
  blocked: "Blocked",
  cancelled: "Cancelled",
  completed: "Completed",
  in_progress: "In Progress",
  needed: "Needed",
  ordered: "Ordered",
  parts_needed: "Parts Needed",
  waiting_parts: "Waiting Parts",
};

const approvalStatusLabels = {
  approved: "Approved",
  not_required: "Not Required",
  pending: "Pending Review",
  rejected: "Rejected",
};

const purchaseOrderStatusLabels = {
  cancelled: "Cancelled",
  draft: "Draft",
  ordered: "Ordered",
  partial_received: "Partial Received",
  received: "Received",
};

const thirdPartyStatusLabels = {
  cancelled: "Cancelled",
  completed: "Completed",
  in_progress: "In Progress",
  planned: "Planned",
  returned: "Returned",
  sent_out: "Sent Out",
};

const openPurchaseOrderStatuses = ["ordered", "partial_received"];
const thirdPartyOutStatuses = ["sent_out", "in_progress"];

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
  return sales.reduce((total, sale) => total + numberOrZero(sale.sale_price), 0);
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

function genericBadgeClassName(status) {
  if (
    status === "blocked" ||
    status === "cancelled" ||
    status === "rejected"
  ) {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (
    status === "needs_po" ||
    status === "pending" ||
    status === "waiting_parts" ||
    status === "partial_received" ||
    status === "sent_out"
  ) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (
    status === "approved" ||
    status === "in_progress" ||
    status === "ordered"
  ) {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (
    status === "completed" ||
    status === "received" ||
    status === "ready_for_sale"
  ) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function getAttentionHelperText(metricKey) {
  const helperText = {
    blocked_repairs: "Open repair blockers before they stall delivery.",
    open_purchase_orders: "Track ordered parts that still need receiving.",
    parts_need_po: "Create purchase orders for pending parts.",
    pending_review: "Review requested parts before ordering.",
    ready_for_sale: "Vehicles marked ready after final checks.",
    rejected_parts: "Resolve rejected or unavailable part requests.",
    third_party_out: "Follow up on outside repair work.",
    urgent_repairs: "Open high-priority work orders.",
    waiting_parts: "Work orders blocked by parts activity.",
  };

  return helperText[metricKey] ?? "";
}

function getAttentionMetrics({
  partQueueCounts,
  partRequests,
  purchaseOrders,
  repairJobs,
  repairQueueCounts,
  thirdPartyRepairs,
  vehicles,
}) {
  const metrics = [
    {
      actionPage: "Parts",
      count: partQueueCounts.needs_po ?? 0,
      icon: "parts",
      key: "parts_need_po",
      label: "Parts Need PO",
      tone: "amber",
    },
    {
      actionPage: "Purchase Orders",
      count: purchaseOrders.filter((purchaseOrder) =>
        openPurchaseOrderStatuses.includes(purchaseOrder.status)
      ).length,
      icon: "file",
      key: "open_purchase_orders",
      label: "Open Purchase Orders",
      tone: "blue",
    },
    {
      actionPage: "Repairs",
      count: repairQueueCounts.waiting_parts ?? 0,
      icon: "clock",
      key: "waiting_parts",
      label: "Waiting Parts Work Orders",
      tone: "amber",
    },
    {
      actionPage: "Repairs",
      count: repairJobs.filter((repairJob) => isRepairJobUrgent(repairJob))
        .length,
      icon: "warning",
      key: "urgent_repairs",
      label: "Urgent Work Orders",
      tone: "red",
    },
    {
      actionPage: "Parts",
      count: partRequests.filter((partRequest) =>
        isPartPendingReview(partRequest)
      ).length,
      icon: "parts",
      key: "pending_review",
      label: "Pending Part Reviews",
      tone: "amber",
    },
    {
      actionPage: "Parts",
      count: partRequests.filter((partRequest) => isPartIssue(partRequest))
        .length,
      icon: "warning",
      key: "rejected_parts",
      label: "Rejected / Issue Parts",
      tone: "red",
    },
    {
      actionPage: "Repairs",
      count: repairJobs.filter((repairJob) => repairJob.status === "blocked")
        .length,
      icon: "warning",
      key: "blocked_repairs",
      label: "Blocked Work Orders",
      tone: "red",
    },
    {
      actionPage: "Repairs",
      count: thirdPartyRepairs.filter((thirdPartyRepair) =>
        thirdPartyOutStatuses.includes(thirdPartyRepair.status)
      ).length,
      icon: "third-party",
      key: "third_party_out",
      label: "Third-Party Repairs Out",
      tone: "blue",
    },
    {
      actionPage: "Vehicles",
      count: vehicles.filter((vehicle) => vehicle.status === "ready_for_sale")
        .length,
      icon: "check",
      key: "ready_for_sale",
      label: "Ready For Sale Vehicles",
      tone: "green",
    },
  ];

  return metrics.map((metric) => ({
    ...metric,
    helperText: getAttentionHelperText(metric.key),
  }));
}

function buildAttentionQueue({
  partRequests,
  purchaseOrders,
  repairJobs,
  thirdPartyRepairs,
  vehiclesById,
}) {
  const queueItems = [];

  repairJobs.forEach((repairJob) => {
    if (isRepairJobUrgent(repairJob)) {
      queueItems.push({
        actionPage: "Repairs",
        actionText: "View Repairs",
        createdAt: repairJob.created_at,
        priority: 100,
        reason: "Urgent priority work order",
        status: repairJob.status,
        statusLabels: workOrderStatusLabels,
        title: repairJob.title || "Untitled work order",
        type: "Urgent Work Order",
        vehicle: vehiclesById[repairJob.vehicle_id],
        vehicleId: repairJob.vehicle_id,
      });
    }

    if (repairJob.status === "blocked") {
      queueItems.push({
        actionPage: "Repairs",
        actionText: "View Repairs",
        createdAt: repairJob.created_at,
        priority: 90,
        reason: "Work cannot continue",
        status: repairJob.status,
        statusLabels: workOrderStatusLabels,
        title: repairJob.title || "Untitled work order",
        type: "Blocked Work Order",
        vehicle: vehiclesById[repairJob.vehicle_id],
        vehicleId: repairJob.vehicle_id,
      });
    }

    if (isRepairJobWaitingParts(repairJob)) {
      queueItems.push({
        actionPage: "Repairs",
        actionText: "View Repairs",
        createdAt: repairJob.created_at,
        priority: 75,
        reason: "Work order is waiting on parts",
        status: repairJob.status,
        statusLabels: workOrderStatusLabels,
        title: repairJob.title || "Untitled work order",
        type: "Waiting Parts",
        vehicle: vehiclesById[repairJob.vehicle_id],
        vehicleId: repairJob.vehicle_id,
      });
    }
  });

  partRequests.forEach((partRequest) => {
    if (isPartNeedsPo(partRequest)) {
      queueItems.push({
        actionPage: "Parts",
        actionText: "View Parts",
        createdAt: partRequest.created_at,
        priority: 85,
        reason: "Part is ready for purchase order",
        status: "needs_po",
        statusLabels: { needs_po: "Needs PO" },
        title: partRequest.part_name || "Unnamed part",
        type: "Part Needs PO",
        vehicle: vehiclesById[partRequest.vehicle_id],
        vehicleId: partRequest.vehicle_id,
      });
    }

    if (partRequest.approval_status === "pending") {
      queueItems.push({
        actionPage: "Parts",
        actionText: "View Parts",
        createdAt: partRequest.created_at,
        priority: 80,
        reason: "Part is waiting for admin review",
        status: partRequest.approval_status,
        statusLabels: approvalStatusLabels,
        title: partRequest.part_name || "Unnamed part",
        type: "Part Review",
        vehicle: vehiclesById[partRequest.vehicle_id],
        vehicleId: partRequest.vehicle_id,
      });
    }

    if (partRequest.approval_status === "rejected") {
      queueItems.push({
        actionPage: "Parts",
        actionText: "View Parts",
        createdAt: partRequest.created_at,
        priority: 95,
        reason: "Part review was rejected or flagged",
        status: partRequest.approval_status,
        statusLabels: approvalStatusLabels,
        title: partRequest.part_name || "Unnamed part",
        type: "Issue Part",
        vehicle: vehiclesById[partRequest.vehicle_id],
        vehicleId: partRequest.vehicle_id,
      });
    }
  });

  purchaseOrders
    .filter((purchaseOrder) =>
      openPurchaseOrderStatuses.includes(purchaseOrder.status)
    )
    .forEach((purchaseOrder) => {
      queueItems.push({
        actionPage: "Purchase Orders",
        actionText: "View Purchase Orders",
        createdAt: purchaseOrder.ordered_at ?? purchaseOrder.created_at,
        priority: purchaseOrder.status === "partial_received" ? 70 : 60,
        reason:
          purchaseOrder.status === "partial_received"
            ? "Purchase order is partially received"
            : "Purchase order is still open",
        status: purchaseOrder.status,
        statusLabels: purchaseOrderStatusLabels,
        title: "Purchase order",
        type: "Purchase Order",
        vehicle: vehiclesById[purchaseOrder.vehicle_id],
        vehicleId: purchaseOrder.vehicle_id,
      });
    });

  thirdPartyRepairs
    .filter((thirdPartyRepair) =>
      thirdPartyOutStatuses.includes(thirdPartyRepair.status)
    )
    .forEach((thirdPartyRepair) => {
      queueItems.push({
        actionText: "View Vehicle",
        createdAt:
          thirdPartyRepair.outbound_date ?? thirdPartyRepair.created_at,
        priority: thirdPartyRepair.status === "sent_out" ? 65 : 55,
        reason: "Outside repair is still active",
        status: thirdPartyRepair.status,
        statusLabels: thirdPartyStatusLabels,
        title: thirdPartyRepair.service_rendered || "Third-party repair",
        type: "Third-Party Repair",
        vehicle: vehiclesById[thirdPartyRepair.vehicle_id],
        vehicleId: thirdPartyRepair.vehicle_id,
      });
    });

  return queueItems
    .sort((firstItem, secondItem) => {
      if (secondItem.priority !== firstItem.priority) {
        return secondItem.priority - firstItem.priority;
      }

      const firstDate = new Date(firstItem.createdAt ?? 0).getTime();
      const secondDate = new Date(secondItem.createdAt ?? 0).getTime();
      return secondDate - firstDate;
    })
    .slice(0, 10);
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
    activityLogsResponse,
  ] = await Promise.all([
    supabase
      .from("vehicle_investment_summary")
      .select("stock_number, make, model, total_invested, estimated_profit")
      .order("stock_number", { ascending: true }),
    supabase
      .from("vehicles")
      .select("id, stock_number, year, make, model, status")
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
      .from("activity_logs")
      .select("id, vehicle_id, action, details, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const firstRequiredError =
    summariesResponse.error ??
    vehiclesResponse.error ??
    salesResponse.error ??
    partRequestsResponse.error ??
    repairJobsResponse.error ??
    purchaseOrdersResponse.error ??
    purchaseOrderItemsResponse.error ??
    thirdPartyRepairsResponse.error;

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
      partRequests,
      purchaseOrders,
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
  red: {
    badge: "border-red-200 bg-red-50 text-red-700",
    icon: "bg-red-50 text-red-700",
  },
};

function getToneClasses(tone) {
  return toneClassNames[tone] ?? toneClassNames.gray;
}

function DashboardSection({ children, className = "", title }) {
  return (
    <section
      className={`rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 className="text-base font-black text-slate-950">{title}</h2>
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
    <article className="flex min-h-20 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
        <AppIcon name={icon} size={19} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className={`mt-1 truncate text-lg font-black sm:text-xl ${valueClassName}`}>
          {value}
        </p>
        {helperText && (
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {helperText}
          </p>
        )}
      </div>
    </article>
  );
}

function DashboardQuickActions({ canStartIntake, onNavigate }) {
  if (!canStartIntake) {
    return null;
  }

  return (
    <section>
      <button
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-base font-black text-white shadow-[0_14px_28px_rgba(5,150,105,0.22)] transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        onClick={() => onNavigate?.("Intake")}
        type="button"
      >
        <AppIcon name="plus" size={20} />
        New Vehicle
      </button>
    </section>
  );
}

function Badge({ children, className }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function DashboardAttentionList({ metrics, onNavigate }) {
  return (
    <DashboardSection title="Needs Attention">
      <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => {
          const toneClasses = getToneClasses(metric.tone);

          return (
            <button
              className="flex min-h-24 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-left transition hover:border-emerald-200 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              key={metric.label}
              onClick={() => onNavigate?.(metric.actionPage)}
              type="button"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneClasses.icon}`}
              >
                <AppIcon name={metric.icon} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900">
                  {metric.label}
                </span>
                {metric.helperText && (
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">
                    {metric.helperText}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`inline-flex min-w-9 items-center justify-center rounded-full border px-2.5 py-1 text-sm font-black ${toneClasses.badge}`}
                >
                  {formatNumber(metric.count)}
                </span>
                <span className="text-xs font-bold text-slate-400">Open</span>
              </span>
            </button>
          );
        })}
      </div>
    </DashboardSection>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 shadow-sm">
        Loading dashboard...
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm"
            key={index}
          />
        ))}
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="h-4 w-36 rounded-full bg-slate-200" />
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              className="h-20 animate-pulse rounded-2xl bg-slate-100"
              key={index}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function getQueueIcon(item) {
  if (item.type.includes("Part")) {
    return "parts";
  }

  if (item.type.includes("Purchase")) {
    return "file";
  }

  if (item.type.includes("Third-Party")) {
    return "third-party";
  }

  if (item.status === "blocked" || item.priority >= 90) {
    return "warning";
  }

  return "wrench";
}

function getQueueTone(item) {
  if (item.status === "blocked" || item.status === "rejected") {
    return "red";
  }

  if (item.status === "pending" || item.status === "waiting_parts") {
    return "amber";
  }

  if (item.status === "ordered" || item.status === "in_progress") {
    return "blue";
  }

  return "gray";
}

function AttentionQueue({ items, onNavigate, onSelectVehicle }) {
  function handleAction(item) {
    if (item.actionPage) {
      onNavigate?.(item.actionPage);
      return;
    }

    if (item.vehicleId) {
      onSelectVehicle?.(item.vehicleId);
    }
  }

  return (
    <DashboardSection title="Attention Queue">
      {items.length === 0 ? (
        <div className="m-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 sm:m-5">
          Nothing urgent in the queue right now.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item, index) => (
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 sm:px-5"
              disabled={!item.actionPage && !item.vehicleId}
              key={`${item.type}-${item.vehicleId}-${item.title}-${index}`}
              onClick={() => handleAction(item)}
              type="button"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  getToneClasses(getQueueTone(item)).icon
                }`}
              >
                <AppIcon name={getQueueIcon(item)} size={20} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-black text-slate-950">
                    {item.title}
                  </h3>
                  <Badge className={genericBadgeClassName(item.status)}>
                    {formatLabel(item.status, item.statusLabels)}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {item.type} - {getVehicleLabel(item.vehicle)}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-600">
                  {item.reason}
                </p>
              </div>

              <AppIcon
                className="shrink-0 text-slate-400"
                name="chevron-right"
                size={18}
              />
            </button>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}

function RecentActivity({ activityLogs, vehiclesById }) {
  const visibleActivityLogs = activityLogs.slice(0, 5);

  return (
    <DashboardSection title="Recent Activity">
      {visibleActivityLogs.length === 0 ? (
        <div className="m-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 sm:m-5">
          No recent activity found yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {visibleActivityLogs.map((activityLog) => (
            <div
              className="flex items-start gap-3 px-4 py-3 sm:px-5"
              key={activityLog.id}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <AppIcon name="status" size={18} />
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

function Dashboard({ currentProfile, onNavigate, onSelectVehicle }) {
  const [activityLogs, setActivityLogs] = useState([]);
  const [investmentSummaries, setInvestmentSummaries] = useState([]);
  const [partRequests, setPartRequests] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [repairJobs, setRepairJobs] = useState([]);
  const [returnDeductionsByVehicleId, setReturnDeductionsByVehicleId] =
    useState({});
  const [sales, setSales] = useState([]);
  const [thirdPartyRepairs, setThirdPartyRepairs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
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
          setPartRequests([]);
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
        setPartRequests(data.partRequests);
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
          setPartRequests([]);
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
  const attentionMetrics = getAttentionMetrics({
    partQueueCounts,
    partRequests,
    purchaseOrders,
    repairJobs,
    repairQueueCounts,
    thirdPartyRepairs,
    vehicles,
  });
  const attentionQueue = buildAttentionQueue({
    partRequests,
    purchaseOrders,
    repairJobs,
    thirdPartyRepairs,
    vehiclesById,
  });

  if (!canViewDashboard) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
        You do not have permission to view the dashboard.
      </section>
    );
  }

  return (
    <div className="space-y-4">
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
              value={formatNumber(soldVehicles.length)}
            />
            <SummaryCard
              helperText="Sale revenue"
              icon="dollar"
              label="Sold Revenue"
              value={formatCurrency(soldRevenue)}
              valueClassName="text-emerald-700"
            />
          </section>

          <DashboardAttentionList
            metrics={attentionMetrics}
            onNavigate={onNavigate}
          />

          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
            <AttentionQueue
              items={attentionQueue}
              onNavigate={onNavigate}
              onSelectVehicle={onSelectVehicle}
            />

            <RecentActivity
              activityLogs={activityLogs}
              vehiclesById={vehiclesById}
            />
          </div>

          {vehicles.length === 0 && investmentSummaries.length === 0 && (
            <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
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
