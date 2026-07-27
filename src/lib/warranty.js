export const DEFAULT_WARRANTY_MONTHS = 3;
export const MIN_WARRANTY_MONTHS = 1;
export const MAX_WARRANTY_MONTHS = 12;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function getDateParts(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      day: value.getDate(),
      month: value.getMonth() + 1,
      year: value.getFullYear(),
    };
  }

  const dateValue = String(value ?? "").slice(0, 10);
  const match = DATE_ONLY_PATTERN.exec(dateValue);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { day, month, year };
}

function datePartsToValue({ day, month, year }) {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function datePartsToDayNumber(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day) / MILLISECONDS_PER_DAY;
}

function firstPresentValue(record, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = record?.[fieldName];

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

export function getTodayDateValue(now = new Date()) {
  const parts = getDateParts(now);

  return parts ? datePartsToValue(parts) : "";
}

export function getWarrantyDateValue(value) {
  const parts = getDateParts(value);

  return parts ? datePartsToValue(parts) : "";
}

export function createWarrantyRecordValues({
  endDate,
  months,
  notes,
  persistMonths = true,
  saleId,
  startDate,
  type,
}) {
  const normalizedNotes = String(notes ?? "").trim();
  const normalizedType = String(type ?? "").trim();

  return {
    end_date: getWarrantyDateValue(endDate) || null,
    sale_id: saleId,
    start_date: getWarrantyDateValue(startDate) || null,
    terms: normalizedNotes || null,
    warranty_months: persistMonths ? normalizeWarrantyMonths(months) : null,
    warranty_type: normalizedType || null,
  };
}

export function normalizeWarrantyMonths(
  value,
  fallback = DEFAULT_WARRANTY_MONTHS
) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(
    MAX_WARRANTY_MONTHS,
    Math.max(MIN_WARRANTY_MONTHS, Math.round(numberValue))
  );
}

export function addWarrantyMonths(startDate, monthCount) {
  const startParts = getDateParts(startDate);

  if (!startParts) {
    return "";
  }

  const months = normalizeWarrantyMonths(monthCount);
  const targetMonthIndex = startParts.month - 1 + months;
  const targetYear = startParts.year + Math.floor(targetMonthIndex / 12);
  const targetMonthIndexWithinYear =
    ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonthIndexWithinYear + 1, 0)
  ).getUTCDate();

  return datePartsToValue({
    day: Math.min(startParts.day, lastDayOfTargetMonth),
    month: targetMonthIndexWithinYear + 1,
    year: targetYear,
  });
}

export function getWarrantyStartDate(warranty) {
  return firstPresentValue(warranty, [
    "start_date",
    "warranty_start_date",
  ]);
}

export function getWarrantyEndDate(warranty) {
  return firstPresentValue(warranty, ["end_date", "warranty_end_date"]);
}

export function getWarrantyNotes(warranty) {
  return firstPresentValue(warranty, [
    "terms",
    "warranty_terms",
    "warranty_notes",
    "notes",
  ]);
}

export function getWarrantyType(warranty) {
  return firstPresentValue(warranty, ["warranty_type", "type"]);
}

export function getWarrantyMonths(warranty) {
  const storedMonths = Number(
    firstPresentValue(warranty, ["warranty_months", "months"])
  );

  if (
    Number.isInteger(storedMonths) &&
    storedMonths >= MIN_WARRANTY_MONTHS &&
    storedMonths <= MAX_WARRANTY_MONTHS
  ) {
    return storedMonths;
  }

  const startParts = getDateParts(getWarrantyStartDate(warranty));
  const endParts = getDateParts(getWarrantyEndDate(warranty));

  if (!startParts || !endParts) {
    return null;
  }

  const normalizedStartDate = datePartsToValue(startParts);
  const normalizedEndDate = datePartsToValue(endParts);

  for (
    let months = MIN_WARRANTY_MONTHS;
    months <= MAX_WARRANTY_MONTHS;
    months += 1
  ) {
    if (addWarrantyMonths(normalizedStartDate, months) === normalizedEndDate) {
      return months;
    }
  }

  return null;
}

export function getWarrantyStatus(endDate, today = getTodayDateValue()) {
  const endParts = getDateParts(endDate);
  const todayParts = getDateParts(today);

  if (!endParts || !todayParts) {
    return {
      daysRemaining: null,
      key: "none",
      label: "No Warranty",
      tone: "neutral",
    };
  }

  const daysRemaining =
    datePartsToDayNumber(endParts) - datePartsToDayNumber(todayParts);

  if (daysRemaining < 0) {
    return {
      daysRemaining,
      key: "expired",
      label: "Expired",
      tone: "danger",
    };
  }

  if (daysRemaining <= 30) {
    return {
      daysRemaining,
      key: "expiring",
      label: "Expiring Soon",
      tone: "warning",
    };
  }

  return {
    daysRemaining,
    key: "active",
    label: "Active Warranty",
    tone: "success",
  };
}

export function formatWarrantyDate(value, fallback = "Not available") {
  const parts = getDateParts(value);

  if (!parts) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}
