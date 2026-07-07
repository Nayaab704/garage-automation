export const purchaseOrderItemReturnColumns =
  "return_status, returned_at, returned_by, return_reason, returned_quantity, returned_amount, returned_shipping_amount, return_notes";

export const returnReasonOptions = [
  { label: "Not required", value: "not_required" },
  { label: "Damaged", value: "damaged" },
  { label: "Wrong part", value: "wrong_part" },
  { label: "Duplicate order", value: "duplicate_order" },
  { label: "Other", value: "other" },
];

const returnReasonLabels = Object.fromEntries(
  returnReasonOptions.map((option) => [option.value, option.label])
);

function numberOrZero(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function formatReturnReason(value) {
  return returnReasonLabels[value] ?? "";
}

export function isPurchaseOrderItemReturned(item) {
  return item?.return_status === "returned" || item?.status === "returned";
}

export function getPurchaseOrderItemSubtotal(item) {
  const quantity =
    item?.quantity === null || item?.quantity === undefined || item?.quantity === ""
      ? 1
      : numberOrZero(item.quantity);

  return quantity * numberOrZero(item?.unit_cost);
}

export function getPurchaseOrderItemGrossTotal(item) {
  return (
    getPurchaseOrderItemSubtotal(item) +
    numberOrZero(item?.shipping_cost) +
    numberOrZero(item?.tax)
  );
}

export function getReturnDeduction(item) {
  if (!isPurchaseOrderItemReturned(item)) {
    return 0;
  }

  return getPurchaseOrderItemGrossTotal(item);
}

export function getPurchaseOrderItemNetTotal(item) {
  return Math.max(getPurchaseOrderItemGrossTotal(item) - getReturnDeduction(item), 0);
}

export function getReturnedPurchaseOrderItems(part) {
  return (part?.purchaseOrderItems ?? []).filter(isPurchaseOrderItemReturned);
}

export function getPrimaryReturnedPurchaseOrderItem(part) {
  return getReturnedPurchaseOrderItems(part)[0] ?? null;
}

export function getPartReturnDeduction(part) {
  return getReturnedPurchaseOrderItems(part).reduce(
    (total, item) => total + getReturnDeduction(item),
    0
  );
}

export function getPurchaseOrderReturnDeduction(items = []) {
  return items.reduce((total, item) => total + getReturnDeduction(item), 0);
}

export function applyReturnDeductionToInvestmentSummary(
  investmentSummary,
  returnDeduction = 0
) {
  if (!investmentSummary) {
    return investmentSummary;
  }

  const deduction = numberOrZero(returnDeduction);

  if (deduction <= 0) {
    return investmentSummary;
  }

  return {
    ...investmentSummary,
    estimated_profit: numberOrZero(investmentSummary.estimated_profit) + deduction,
    returned_parts_deduction: deduction,
    total_invested: Math.max(
      numberOrZero(investmentSummary.total_invested) - deduction,
      0
    ),
  };
}
