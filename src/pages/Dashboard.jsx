import { useEffect, useMemo, useState } from "react";
import VehicleStatusBadge from "../components/VehicleStatusBadge";
import { hasPermission } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";
import {
  formatVehicleStatus,
  getVehicleStatusClassName,
  vehicleStatusOptions,
} from "../lib/vehicleStatus";

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
const closedWorkOrderStatuses = ["completed", "cancelled"];

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

function isSoldVehicle(vehicle) {
  return String(vehicle.status ?? "").toLowerCase() === "sold";
}

function isActiveVehicle(vehicle) {
  const status = String(vehicle.status ?? "").toLowerCase();
  return status !== "sold" && status !== "archived";
}

function countVehiclesByStatus(vehicles) {
  return vehicles.reduce((counts, vehicle) => {
    const status = vehicle.status || "not_available";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

function getStatusOverviewRows(statusCounts) {
  const customStatuses = Object.keys(statusCounts).filter(
    (status) => !vehicleStatusOptions.includes(status)
  );

  return [...vehicleStatusOptions, ...customStatuses].map((status) => ({
    count: statusCounts[status] ?? 0,
    status,
  }));
}

function mergeVehiclesWithSummaries(vehicles, summaries) {
  const summariesByStockNumber = new Map(
    summaries.map((summary) => [summary.stock_number, summary])
  );

  return vehicles.map((vehicle) => {
    const summary = summariesByStockNumber.get(vehicle.stock_number) ?? {};

    return {
      ...vehicle,
      estimated_profit: summary.estimated_profit ?? 0,
      total_invested: summary.total_invested ?? 0,
    };
  });
}

function getTopActiveInvestments(vehicles, summaries) {
  return mergeVehiclesWithSummaries(vehicles, summaries)
    .filter(isActiveVehicle)
    .sort(
      (firstVehicle, secondVehicle) =>
        numberOrZero(secondVehicle.total_invested) -
        numberOrZero(firstVehicle.total_invested)
    )
    .slice(0, 5);
}

function getSalesTotal(sales) {
  return sales.reduce((total, sale) => total + numberOrZero(sale.sale_price), 0);
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
    ? summaryParts.join(" · ")
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

function getAttentionMetrics({
  partRequests,
  purchaseOrders,
  repairJobs,
  thirdPartyRepairs,
  vehicles,
}) {
  const activeUrgentWorkOrders = repairJobs.filter(
    (repairJob) =>
      repairJob.priority === "urgent" &&
      !closedWorkOrderStatuses.includes(repairJob.status)
  );

  return [
    {
      accent: "border-amber-200 bg-amber-50 text-amber-800",
      count: partRequests.filter(
        (partRequest) => partRequest.approval_status === "pending"
      ).length,
      label: "Pending Part Reviews",
    },
    {
      accent: "border-red-200 bg-red-50 text-red-800",
      count: partRequests.filter(
        (partRequest) => partRequest.approval_status === "rejected"
      ).length,
      label: "Rejected / Issue Parts",
    },
    {
      accent: "border-amber-200 bg-amber-50 text-amber-800",
      count: repairJobs.filter(
        (repairJob) => repairJob.status === "waiting_parts"
      ).length,
      label: "Waiting Parts Work Orders",
    },
    {
      accent: "border-red-200 bg-red-50 text-red-800",
      count: repairJobs.filter((repairJob) => repairJob.status === "blocked")
        .length,
      label: "Blocked Work Orders",
    },
    {
      accent: "border-red-200 bg-red-50 text-red-800",
      count: activeUrgentWorkOrders.length,
      label: "Urgent Work Orders",
    },
    {
      accent: "border-blue-200 bg-blue-50 text-blue-800",
      count: purchaseOrders.filter((purchaseOrder) =>
        openPurchaseOrderStatuses.includes(purchaseOrder.status)
      ).length,
      label: "Open Purchase Orders",
    },
    {
      accent: "border-blue-200 bg-blue-50 text-blue-800",
      count: thirdPartyRepairs.filter((thirdPartyRepair) =>
        thirdPartyOutStatuses.includes(thirdPartyRepair.status)
      ).length,
      label: "Third-Party Repairs Out",
    },
    {
      accent: "border-emerald-200 bg-emerald-50 text-emerald-800",
      count: vehicles.filter((vehicle) => vehicle.status === "ready_for_sale")
        .length,
      label: "Ready For Sale Vehicles",
    },
  ];
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
    if (
      repairJob.priority === "urgent" &&
      !closedWorkOrderStatuses.includes(repairJob.status)
    ) {
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

    if (repairJob.status === "waiting_parts") {
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
    thirdPartyRepairsResponse.error;

  if (firstRequiredError) {
    return { data: null, error: firstRequiredError };
  }

  return {
    data: {
      activityLogs: activityLogsResponse.error
        ? []
        : activityLogsResponse.data ?? [],
      investmentSummaries: summariesResponse.data ?? [],
      partRequests: partRequestsResponse.data ?? [],
      purchaseOrders: purchaseOrdersResponse.data ?? [],
      repairJobs: repairJobsResponse.data ?? [],
      sales: salesResponse.data ?? [],
      thirdPartyRepairs: thirdPartyRepairsResponse.data ?? [],
      vehicles: vehiclesResponse.data ?? [],
    },
    error: null,
  };
}

function SummaryCard({ label, value, valueClassName = "text-zinc-950" }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClassName}`}>{value}</p>
    </article>
  );
}

function AttentionMetricCard({ accent, count, label }) {
  return (
    <article className={`rounded-lg border p-4 shadow-sm ${accent}`}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-2 text-3xl font-bold">{formatNumber(count)}</p>
    </article>
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
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-zinc-950">Attention Queue</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Top operational items that may need manager review today.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
          Nothing urgent in the queue right now.
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {items.map((item, index) => (
            <div
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 xl:flex-row xl:items-start xl:justify-between"
              key={`${item.type}-${item.vehicleId}-${item.title}-${index}`}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-zinc-100 text-zinc-700 ring-zinc-200">
                    {item.type}
                  </Badge>
                  <Badge className={genericBadgeClassName(item.status)}>
                    {formatLabel(item.status, item.statusLabels)}
                  </Badge>
                </div>
                <h3 className="mt-2 font-bold text-zinc-950">{item.title}</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {getVehicleLabel(item.vehicle)}
                </p>
                <p className="mt-2 text-sm text-zinc-700">{item.reason}</p>
              </div>

              <button
                className="w-fit rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!item.actionPage && !item.vehicleId}
                onClick={() => handleAction(item)}
                type="button"
              >
                {item.actionText}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentActivity({ activityLogs, vehiclesById }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-zinc-950">Recent Activity</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Latest vehicle actions across the garage.
        </p>
      </div>

      {activityLogs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
          No recent activity found yet.
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {activityLogs.map((activityLog) => (
            <div className="py-4 first:pt-0 last:pb-0" key={activityLog.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-950">
                    {activityLog.action}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {getVehicleLabel(vehiclesById[activityLog.vehicle_id])}
                  </p>
                </div>
                <p className="text-sm text-zinc-500">
                  {formatDate(activityLog.created_at)}
                </p>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {summarizeActivityDetails(activityLog.details)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TopActiveInvestments({ vehicles }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-zinc-950">
          Top Active Investments
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Top 5 active vehicles by total invested.
        </p>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
          No active investment data found yet.
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {vehicles.map((vehicle, index) => (
            <div
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              key={vehicle.id ?? `${vehicle.stock_number}-${index}`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-700">
                  {index + 1}
                </span>
                <div>
                  <p className="font-bold text-zinc-950">
                    {vehicle.stock_number ?? "No Stock Number"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {getVehicleName(vehicle) || "Unknown Vehicle"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <VehicleStatusBadge status={vehicle.status} />
                <span className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  {formatCurrency(vehicle.total_invested)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatusOverview({ rows }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-zinc-950">Status Overview</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Vehicle count by workflow status.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 bg-zinc-50 px-4 py-3"
            key={row.status}
          >
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${getVehicleStatusClassName(
                row.status
              )}`}
            >
              {formatVehicleStatus(row.status)}
            </span>
            <span className="text-lg font-bold text-zinc-950">
              {formatNumber(row.count)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Dashboard({ currentProfile, onNavigate, onSelectVehicle }) {
  const [activityLogs, setActivityLogs] = useState([]);
  const [investmentSummaries, setInvestmentSummaries] = useState([]);
  const [partRequests, setPartRequests] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [repairJobs, setRepairJobs] = useState([]);
  const [sales, setSales] = useState([]);
  const [thirdPartyRepairs, setThirdPartyRepairs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const canViewDashboard = hasPermission(
    currentProfile?.role,
    "dashboard:view"
  );

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
          setErrorMessage(error.message);
          setActivityLogs([]);
          setInvestmentSummaries([]);
          setPartRequests([]);
          setPurchaseOrders([]);
          setRepairJobs([]);
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
        setSales(data.sales);
        setThirdPartyRepairs(data.thirdPartyRepairs);
        setVehicles(data.vehicles);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message ?? "Something went wrong.");
          setActivityLogs([]);
          setInvestmentSummaries([]);
          setPartRequests([]);
          setPurchaseOrders([]);
          setRepairJobs([]);
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

  const activeVehicles = vehicles.filter(isActiveVehicle);
  const soldVehicles = vehicles.filter(isSoldVehicle);
  const activeInvestmentRows = mergeVehiclesWithSummaries(
    vehicles,
    investmentSummaries
  ).filter(isActiveVehicle);
  const activeInventoryInvestment = activeInvestmentRows.reduce(
    (total, vehicle) => total + numberOrZero(vehicle.total_invested),
    0
  );
  const estimatedActiveProfit = activeInvestmentRows.reduce(
    (total, vehicle) => total + numberOrZero(vehicle.estimated_profit),
    0
  );
  const soldRevenue = getSalesTotal(sales);
  const attentionMetrics = getAttentionMetrics({
    partRequests,
    purchaseOrders,
    repairJobs,
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
  const topActiveInvestments = getTopActiveInvestments(
    vehicles,
    investmentSummaries
  );
  const statusOverviewRows = getStatusOverviewRows(
    countVehiclesByStatus(vehicles)
  );

  if (!canViewDashboard) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
        You do not have permission to view the dashboard.
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {isLoading && (
        <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-zinc-700">
            Loading dashboard analytics...
          </p>
        </section>
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          <h2 className="font-semibold">Unable to load dashboard data</h2>
          <p className="mt-2 text-sm">{errorMessage}</p>
        </section>
      )}

      {!isLoading && !errorMessage && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <SummaryCard
              label="Total Vehicles"
              value={formatNumber(vehicles.length)}
            />
            <SummaryCard
              label="Active Inventory"
              value={formatNumber(activeVehicles.length)}
            />
            <SummaryCard
              label="Active Inventory Investment"
              value={formatCurrency(activeInventoryInvestment)}
            />
            <SummaryCard
              label="Estimated Active Profit"
              value={formatCurrency(estimatedActiveProfit)}
              valueClassName={
                estimatedActiveProfit < 0 ? "text-red-700" : "text-emerald-700"
              }
            />
            <SummaryCard
              label="Sold Vehicles"
              value={formatNumber(soldVehicles.length)}
            />
            <SummaryCard
              label="Sold Revenue"
              value={formatCurrency(soldRevenue)}
              valueClassName="text-emerald-700"
            />
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-zinc-950">
                Needs Attention
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Counts for parts, repairs, orders, and vehicles that may need
                manager review.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {attentionMetrics.map((metric) => (
                <AttentionMetricCard
                  accent={metric.accent}
                  count={metric.count}
                  key={metric.label}
                  label={metric.label}
                />
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <AttentionQueue
              items={attentionQueue}
              onNavigate={onNavigate}
              onSelectVehicle={onSelectVehicle}
            />
            <RecentActivity
              activityLogs={activityLogs}
              vehiclesById={vehiclesById}
            />
          </section>

          {vehicles.length === 0 && investmentSummaries.length === 0 ? (
            <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-900">
                No vehicles found
              </h2>
              <p className="mt-2 text-zinc-600">
                Add vehicles to inventory and the dashboard will start filling
                in.
              </p>
            </section>
          ) : (
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
              <TopActiveInvestments vehicles={topActiveInvestments} />
              <StatusOverview rows={statusOverviewRows} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;
