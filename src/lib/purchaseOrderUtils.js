import {
  buildSearchText,
  findMatchingVehicles,
  getVehicleSearchValues,
  matchesSearchText,
  normalizeSearchText,
} from "./searchText";

export const PURCHASE_ORDER_TABS = [
  { key: "ordered", label: "Ordered" },
  { key: "received", label: "Received" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

export const purchaseOrderStatusLabels = {
  cancelled: "Cancelled",
  draft: "Draft",
  open: "Ordered",
  ordered: "Ordered",
  partial_received: "Partial Received",
  received: "Received",
  returned: "Returned",
};

const closedStatuses = ["received", "cancelled"];

function normalizeSearch(value) {
  return normalizeSearchText(value);
}

export function formatPurchaseOrderLabel(value, labels = purchaseOrderStatusLabels) {
  if (labels[value]) {
    return labels[value];
  }

  if (!value) {
    return "Not available";
  }

  return String(value)
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatSearchLabel(value, labels = purchaseOrderStatusLabels) {
  return value ? formatPurchaseOrderLabel(value, labels) : "";
}

function getVehicleNameSearchValues(vehicle) {
  return [vehicle?.year, vehicle?.make, vehicle?.model, vehicle?.trim]
    .filter(Boolean)
    .join(" ");
}

function getPurchaseOrderVehicleIds(purchaseOrder) {
  return [
    purchaseOrder?.vehicle_id,
    purchaseOrder?.vehicle?.id,
    purchaseOrder?.vehicleContext?.id,
    ...(purchaseOrder?.vehicleContexts ?? []).map((vehicle) => vehicle.id),
    ...(purchaseOrder?.items ?? []).flatMap((item) => [
      item.vehicle_id,
      item.vehicle?.id,
      item.vehicleContext?.id,
      item.partRequest?.vehicle_id,
      item.partRequest?.vehicle?.id,
      item.partRequest?.vehicleContext?.id,
      item.partRequest?.repairJob?.vehicle_id,
      item.partRequest?.repairJob?.vehicle?.id,
      item.partRequest?.repairJob?.vehicleContext?.id,
      item.part_request?.vehicle_id,
      item.part_request?.repair_job?.vehicle_id,
      item.part_request?.repair_jobs?.vehicle_id,
    ]),
  ]
    .filter(Boolean)
    .map(String);
}

function getPurchaseOrderVehicleMatchText(purchaseOrder) {
  return buildSearchText([
    purchaseOrder?.searchText,
    purchaseOrder?.vehicleSearchText,
    purchaseOrder?.vehicleLabel,
    purchaseOrder?.vehicleDisplay,
    ...getVehicleSearchValues(purchaseOrder?.vehicleContext),
    ...getVehicleSearchValues(purchaseOrder?.vehicle),
    ...(purchaseOrder?.vehicleContexts ?? []).flatMap(getVehicleSearchValues),
    ...(purchaseOrder?.items ?? []).flatMap((item) => [
      item.vehicleSearchText,
      item.vehicleLabel,
      item.vehicleDisplay,
      ...getVehicleSearchValues(item.vehicleContext),
      ...getVehicleSearchValues(item.vehicle),
      item.partRequest?.vehicleSearchText,
      ...getVehicleSearchValues(item.partRequest?.vehicleContext),
      ...getVehicleSearchValues(item.partRequest?.vehicle),
      item.partRequest?.repairJob?.vehicleSearchText,
      ...getVehicleSearchValues(item.partRequest?.repairJob?.vehicleContext),
      ...getVehicleSearchValues(item.partRequest?.repairJob?.vehicle),
    ]),
  ]);
}

function doesPurchaseOrderMatchVehicle(purchaseOrder, matchedVehicles = []) {
  if (matchedVehicles.length === 0) {
    return false;
  }

  const purchaseOrderVehicleIds = new Set(
    getPurchaseOrderVehicleIds(purchaseOrder)
  );
  const purchaseOrderVehicleText = getPurchaseOrderVehicleMatchText(
    purchaseOrder
  );

  return matchedVehicles.some((vehicle) => {
    const vehicleName = buildSearchText([
      getVehicleNameSearchValues(vehicle),
      vehicle?.color,
    ]);

    return (
      (vehicle?.id && purchaseOrderVehicleIds.has(String(vehicle.id))) ||
      (vehicle?.stock_number &&
        purchaseOrderVehicleText.includes(
          normalizeSearch(vehicle.stock_number)
        )) ||
      (vehicle?.vin &&
        purchaseOrderVehicleText.includes(normalizeSearch(vehicle.vin))) ||
      (vehicleName && purchaseOrderVehicleText.includes(vehicleName))
    );
  });
}

export function getPurchaseOrderBadge(status) {
  if (status === "received") {
    return {
      className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      label: "Received",
    };
  }

  if (status === "cancelled") {
    return {
      className: "bg-red-50 text-red-700 ring-red-200",
      label: "Cancelled",
    };
  }

  if (status === "returned") {
    return {
      className: "bg-red-50 text-red-700 ring-red-200",
      label: "Returned",
    };
  }

  if (status === "partial_received") {
    return {
      className: "bg-amber-50 text-amber-700 ring-amber-200",
      label: "Partial Received",
    };
  }

  return {
    className: "bg-blue-50 text-blue-700 ring-blue-200",
    label: formatPurchaseOrderLabel(status || "ordered"),
  };
}

export function isPurchaseOrderOpen(purchaseOrder) {
  return !closedStatuses.includes(purchaseOrder?.status);
}

export function purchaseOrderMatchesTab(purchaseOrder, tabKey) {
  if (tabKey === "ordered") {
    return ["draft", "open", "ordered", "partial_received"].includes(
      purchaseOrder?.status
    );
  }

  if (tabKey === "received") {
    return purchaseOrder?.status === "received";
  }

  if (tabKey === "cancelled") {
    return purchaseOrder?.status === "cancelled";
  }

  return true;
}

export function getPurchaseOrderCounts(purchaseOrders = []) {
  return PURCHASE_ORDER_TABS.reduce((counts, tab) => {
    counts[tab.key] =
      tab.key === "all"
        ? purchaseOrders.length
        : purchaseOrders.filter((purchaseOrder) =>
            purchaseOrderMatchesTab(purchaseOrder, tab.key)
          ).length;
    return counts;
  }, {});
}

export function getPurchaseOrderSearchText(purchaseOrder) {
  const vehicle = purchaseOrder?.vehicle;
  const vendor = purchaseOrder?.vendor;
  const items = purchaseOrder?.items ?? [];
  const purchaseOrderId = purchaseOrder?.id;
  const shortPurchaseOrderId = String(purchaseOrderId ?? "")
    .slice(0, 8)
    .toUpperCase();

  return buildSearchText([
    purchaseOrderId,
    shortPurchaseOrderId,
    shortPurchaseOrderId ? `PO ${shortPurchaseOrderId}` : "",
    purchaseOrder?.status,
    purchaseOrder?.notes,
    formatSearchLabel(purchaseOrder?.status),
    purchaseOrder?.orderedBy?.full_name,
    purchaseOrder?.orderedBy?.email,
    purchaseOrder?.receivedBy?.full_name,
    purchaseOrder?.receivedBy?.email,
    purchaseOrder?.vehicleVin,
    purchaseOrder?.vehicle_vin,
    ...(purchaseOrder?.vehicleVins ?? []),
    purchaseOrder?.vehicleSearchText,
    ...getVehicleSearchValues(purchaseOrder?.vehicleContext),
    ...getVehicleSearchValues(vehicle),
    ...getVehicleSearchValues(purchaseOrder?.vehicles),
    ...(purchaseOrder?.vehicleContexts ?? []).flatMap(getVehicleSearchValues),
    vendor?.name,
    vendor?.phone,
    vendor?.email,
    ...items.flatMap((item) => [
      item.description,
      item.notes,
      item.status,
      formatSearchLabel(item.status, {}),
      item.return_reason,
      item.return_notes,
      item.returnedBy?.full_name,
      item.returnedBy?.email,
      item.vehicleVin,
      item.vehicle_vin,
      item.vehicleSearchText,
      ...getVehicleSearchValues(item.vehicleContext),
      ...getVehicleSearchValues(item.vehicle),
      ...getVehicleSearchValues(item.vehicles),
      item.partRequest?.part_name,
      item.partRequest?.status,
      item.partRequest?.part_source,
      item.partRequest?.approval_status,
      item.partRequest?.vehicleVin,
      item.partRequest?.vehicleSearchText,
      ...getVehicleSearchValues(item.partRequest?.vehicleContext),
      ...getVehicleSearchValues(item.partRequest?.vehicle),
      ...getVehicleSearchValues(item.partRequest?.vehicles),
      item.partRequest?.selectedQuote?.vendor_name_snapshot,
      item.partRequest?.selectedQuote?.raw_part_name,
      item.partRequest?.selectedQuote?.quote_status,
      item.partRequest?.selectedQuote?.availability,
      item.partRequest?.repairJob?.title,
      item.partRequest?.repairJob?.category,
      item.partRequest?.repairJob?.status,
      item.partRequest?.repairJob?.vehicleVin,
      item.partRequest?.repairJob?.vehicleSearchText,
      ...getVehicleSearchValues(item.partRequest?.repairJob?.vehicleContext),
      ...getVehicleSearchValues(item.partRequest?.repairJob?.vehicle),
      ...getVehicleSearchValues(item.partRequest?.repairJob?.vehicles),
      item.partRequest?.repairJob?.serviceCategory?.name,
    ]),
  ]);
}

export function filterPurchaseOrders(
  purchaseOrders = [],
  { search = "", tab = "ordered", vehicleSearchIndex = [] } = {}
) {
  const normalizedSearch = normalizeSearch(search);
  const matchedVehicles = findMatchingVehicles(vehicleSearchIndex, search);

  return purchaseOrders.filter((purchaseOrder) => {
    if (!purchaseOrderMatchesTab(purchaseOrder, tab)) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return matchesSearchText(
      purchaseOrder.searchText || getPurchaseOrderSearchText(purchaseOrder),
      search
    ) || doesPurchaseOrderMatchVehicle(purchaseOrder, matchedVehicles);
  });
}

export function canMarkPurchaseOrderReceived(purchaseOrder) {
  return ["draft", "open", "ordered", "partial_received"].includes(
    purchaseOrder?.status
  );
}

export function canCancelPurchaseOrder(purchaseOrder) {
  return isPurchaseOrderOpen(purchaseOrder);
}
