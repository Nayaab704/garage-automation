export const PURCHASE_ORDER_TABS = [
  { key: "open", label: "Open" },
  { key: "ordered", label: "Ordered" },
  { key: "received", label: "Received" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

export const purchaseOrderStatusLabels = {
  cancelled: "Cancelled",
  draft: "Draft",
  ordered: "Ordered",
  partial_received: "Partial Received",
  received: "Received",
  returned: "Returned",
};

const closedStatuses = ["received", "cancelled"];

function normalizeSearch(value) {
  return String(value ?? "").trim().toLowerCase();
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
  if (tabKey === "open") {
    return isPurchaseOrderOpen(purchaseOrder);
  }

  if (tabKey === "ordered") {
    return ["draft", "ordered", "partial_received"].includes(purchaseOrder?.status);
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

  return [
    purchaseOrder?.id,
    purchaseOrder?.status,
    vehicle?.stock_number,
    vehicle?.year,
    vehicle?.make,
    vehicle?.model,
    vehicle?.trim,
    vendor?.name,
    ...items.flatMap((item) => [
      item.description,
      item.partRequest?.part_name,
      item.partRequest?.repairJob?.title,
      item.partRequest?.repairJob?.category,
      item.partRequest?.repairJob?.serviceCategory?.name,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterPurchaseOrders(
  purchaseOrders = [],
  { search = "", tab = "open" } = {}
) {
  const normalizedSearch = normalizeSearch(search);

  return purchaseOrders.filter((purchaseOrder) => {
    if (!purchaseOrderMatchesTab(purchaseOrder, tab)) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return getPurchaseOrderSearchText(purchaseOrder).includes(normalizedSearch);
  });
}

export function canMarkPurchaseOrderReceived(purchaseOrder) {
  return ["draft", "ordered", "partial_received"].includes(purchaseOrder?.status);
}

export function canCancelPurchaseOrder(purchaseOrder) {
  return isPurchaseOrderOpen(purchaseOrder);
}
