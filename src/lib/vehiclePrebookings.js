export const prebookingStatuses = [
  { label: "Active", value: "active" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Refunded", value: "refunded" },
];

export const prebookingPaymentMethods = [
  { label: "Select method", value: "" },
  { label: "Cash", value: "Cash" },
  { label: "Card", value: "Card" },
  { label: "Zelle", value: "Zelle" },
  { label: "Check", value: "Check" },
  { label: "Other", value: "Other" },
];

export const activePrebookingBadgeColumns =
  "id, vehicle_id, status, created_at";

export const vehiclePrebookingColumns =
  "id, vehicle_id, customer_name, customer_phone, customer_email, deposit_amount, payment_method, deposit_date, status, notes, receipt_url, created_by, created_at, updated_at, cancelled_by, cancelled_at, refund_amount, refund_date";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 0,
  style: "currency",
});

const detailedCurrencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  style: "currency",
});

const prebookingStatusLabels = {
  active: "Active",
  applied_to_sale: "Applied to Sale",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function emptyToNull(value) {
  const trimmedValue = String(value ?? "").trim();
  return trimmedValue === "" ? null : trimmedValue;
}

export function numberOrZero(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function normalizePrebookingStatus(status) {
  const normalizedStatus = String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return prebookingStatusLabels[normalizedStatus] ? normalizedStatus : "active";
}

export function isActivePrebooking(prebooking) {
  return normalizePrebookingStatus(prebooking?.status) === "active";
}

export function getPrebookingStatusLabel(status) {
  return prebookingStatusLabels[normalizePrebookingStatus(status)] ?? "Active";
}

export function getActivePrebooking(prebookings = []) {
  return (
    prebookings.find((prebooking) => isActivePrebooking(prebooking)) ??
    prebookings[0] ??
    null
  );
}

export function formatPrebookingCurrency(value, { detailed = false } = {}) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  return detailed
    ? detailedCurrencyFormatter.format(amount)
    : currencyFormatter.format(amount);
}

export function getPrebookingBadgeLabel(prebooking) {
  const amountLabel = formatPrebookingCurrency(prebooking?.deposit_amount);

  return amountLabel ? `Prebooked · ${amountLabel}` : "Prebooked";
}

export function buildPrebookingPayload(formData, { currentProfile, vehicleId }) {
  return {
    vehicle_id: vehicleId,
    customer_name: emptyToNull(formData.customer_name),
    customer_phone: emptyToNull(formData.customer_phone),
    customer_email: emptyToNull(formData.customer_email),
    deposit_amount: numberOrZero(formData.deposit_amount),
    payment_method: emptyToNull(formData.payment_method),
    deposit_date: emptyToNull(formData.deposit_date),
    status: normalizePrebookingStatus(formData.status),
    notes: emptyToNull(formData.notes),
    refund_amount: emptyToNull(formData.refund_amount)
      ? numberOrZero(formData.refund_amount)
      : null,
    refund_date: emptyToNull(formData.refund_date),
    cancelled_by:
      normalizePrebookingStatus(formData.status) === "cancelled"
        ? currentProfile?.id ?? null
        : null,
    cancelled_at:
      normalizePrebookingStatus(formData.status) === "cancelled"
        ? new Date().toISOString()
        : null,
  };
}

export function validatePrebookingForm(formData) {
  const depositAmount = Number(formData.deposit_amount || 0);
  const refundAmount = Number(formData.refund_amount || 0);

  if (!Number.isFinite(depositAmount) || depositAmount < 0) {
    return "Deposit amount must be 0 or greater.";
  }

  if (
    String(formData.refund_amount ?? "").trim() &&
    (!Number.isFinite(refundAmount) || refundAmount < 0)
  ) {
    return "Refund amount must be 0 or greater.";
  }

  return "";
}
