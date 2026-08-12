import { getLaborLogCost } from "./laborCost.js";

const excludedCostStatuses = new Set([
  "cancelled",
  "canceled",
  "rejected",
  "returned",
]);
const includedPurchasedPartStatuses = new Set(["ordered", "received"]);

function numberOrZero(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeStatus(value) {
  return String(value ?? "").trim().toLowerCase();
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function getQuantity(value) {
  return hasValue(value) ? numberOrZero(value) : 1;
}

export function getPartRequestCost(partRequest) {
  if (hasValue(partRequest?.quoted_total_cost)) {
    return Math.max(0, numberOrZero(partRequest.quoted_total_cost));
  }

  const unitCost = hasValue(partRequest?.unit_cost)
    ? partRequest.unit_cost
    : partRequest?.quoted_unit_cost;

  return Math.max(
    0,
    getQuantity(partRequest?.quantity) * numberOrZero(unitCost)
  );
}

export function getPurchaseOrderItemOriginalCost(item) {
  return Math.max(
    0,
    getQuantity(item?.quantity) * numberOrZero(item?.unit_cost) +
      numberOrZero(item?.shipping_cost) +
      numberOrZero(item?.tax)
  );
}

function getPurchaseOrderItemCost(item) {
  const grossCost = getPurchaseOrderItemOriginalCost(item);

  return Math.max(
    0,
    grossCost -
      numberOrZero(item?.returned_amount) -
      numberOrZero(item?.returned_shipping_amount)
  );
}

export function getPartFinancialImpact({
  partRequest,
  purchaseOrder,
  purchaseOrderItem,
} = {}) {
  const isInHouse = partRequest?.part_source === "in_house";
  const excludedStatus = [
    purchaseOrderItem?.return_status,
    purchaseOrderItem?.status,
    purchaseOrder?.status,
    partRequest?.status,
    partRequest?.approval_status,
  ]
    .map(normalizeStatus)
    .find((status) => excludedCostStatuses.has(status));
  const originalAmount = purchaseOrderItem
    ? getPurchaseOrderItemOriginalCost(purchaseOrderItem)
    : getPartRequestCost(partRequest);
  const includedAmount = purchaseOrderItem
    ? getPurchaseOrderItemCost(purchaseOrderItem)
    : originalAmount;
  const purchaseStatus = normalizeStatus(
    purchaseOrderItem?.status ?? partRequest?.status ?? purchaseOrder?.status
  );
  const isExcluded = Boolean(excludedStatus);
  const isIncludedPurchased = Boolean(
    purchaseOrderItem &&
      !isInHouse &&
      !isExcluded &&
      includedPurchasedPartStatuses.has(purchaseStatus)
  );
  const isIncludedInHouse = Boolean(isInHouse && !isExcluded);
  const isIncluded = isIncludedPurchased || isIncludedInHouse;

  return {
    displayAmount: isExcluded ? -originalAmount : includedAmount,
    includedAmount: isIncluded ? includedAmount : 0,
    isExcluded,
    isIncluded,
    isIncludedInHouse,
    isIncludedPurchased,
    originalAmount,
    status: excludedStatus || purchaseStatus,
    statusImpact: isExcluded
      ? "Excluded from totals"
      : isIncluded
        ? "Included in totals"
        : "Not included in totals",
  };
}

function getTargetSalePrice(vehicle) {
  const targetPriceFields = [
    vehicle?.target_sale_price,
    vehicle?.expected_sale_price,
    vehicle?.list_price,
  ];

  for (const value of targetPriceFields) {
    if (!hasValue(value)) {
      continue;
    }

    const numberValue = Number(value);

    if (Number.isFinite(numberValue) && numberValue > 0) {
      return numberValue;
    }
  }

  return null;
}

export function calculateVehicleRepairCosts({
  costEntries = [],
  laborLogs = [],
  partRequests = [],
  purchaseOrderItems = [],
  purchaseOrders = [],
  thirdPartyRepairs = [],
} = {}) {
  const partRequestsById = new Map(
    partRequests
      .filter((partRequest) => partRequest?.id)
      .map((partRequest) => [partRequest.id, partRequest])
  );
  const purchaseOrdersById = new Map(
    purchaseOrders
      .filter((purchaseOrder) => purchaseOrder?.id)
      .map((purchaseOrder) => [purchaseOrder.id, purchaseOrder])
  );
  const purchasedPartsCost = purchaseOrderItems.reduce((total, item) => {
    const partRequest = partRequestsById.get(item?.part_request_id);
    const purchaseOrder = purchaseOrdersById.get(item?.purchase_order_id);
    const impact = getPartFinancialImpact({
      partRequest,
      purchaseOrder,
      purchaseOrderItem: item,
    });

    return impact.isIncludedPurchased
      ? total + impact.includedAmount
      : total;
  }, 0);

  const inHousePartsCost = partRequests.reduce((total, partRequest) => {
    const impact = getPartFinancialImpact({ partRequest });

    return impact.isIncludedInHouse
      ? total + impact.includedAmount
      : total;
  }, 0);

  const laborCost = laborLogs.reduce(
    (total, laborLog) => total + Math.max(0, numberOrZero(getLaborLogCost(laborLog))),
    0
  );
  const thirdPartyCost = thirdPartyRepairs.reduce(
    (total, repair) =>
      total +
      Math.max(
        0,
        numberOrZero(repair?.repair_cost) + numberOrZero(repair?.transit_cost)
      ),
    0
  );
  const extraCost = costEntries.reduce(
    (total, entry) =>
      total + Math.max(0, numberOrZero(entry?.amount ?? entry?.cost)),
    0
  );
  const partsCost = purchasedPartsCost + inHousePartsCost;
  const totalRepairCost = partsCost + laborCost + thirdPartyCost + extraCost;

  return {
    extraCost,
    inHousePartsCost,
    laborCost,
    partsCost,
    purchasedPartsCost,
    thirdPartyCost,
    totalRepairCost,
  };
}

export function calculateVehicleFinancialSummary({ vehicle, ...costs } = {}) {
  const repairCosts = calculateVehicleRepairCosts(costs);
  const purchasePrice = Math.max(0, numberOrZero(vehicle?.purchase_price));
  const targetSalePrice = getTargetSalePrice(vehicle);
  const totalInvested = purchasePrice + repairCosts.totalRepairCost;

  return {
    ...repairCosts,
    estimatedProfit:
      targetSalePrice === null ? null : targetSalePrice - totalInvested,
    purchasePrice,
    targetSalePrice,
    totalInvested,
  };
}
