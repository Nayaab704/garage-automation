import { supabase } from "./supabaseClient";
import {
  getTodayDateValue,
  getWarrantyEndDate,
  getWarrantyMonths,
  getWarrantyNotes,
  getWarrantyStartDate,
  getWarrantyStatus,
} from "./warranty";

const PAGE_SIZE = 1000;

export const WARRANTY_REGISTER_COLUMNS = [
  "Stock #",
  "VIN",
  "Year",
  "Make",
  "Model",
  "Trim",
  "Color",
  "Mileage",
  "Vehicle Status",
  "Sold Date",
  "Customer Name",
  "Customer Phone",
  "Customer Email",
  "Sale Price",
  "Warranty Start Date",
  "Warranty Months",
  "Warranty End Date",
  "Warranty Status",
  "Total Investment",
  "Notes",
];

export const VEHICLE_ARCHIVE_COLUMNS = WARRANTY_REGISTER_COLUMNS.filter(
  (column) => column !== "Vehicle Status"
);
export const EXPIRED_WARRANTY_COLUMNS = VEHICLE_ARCHIVE_COLUMNS;

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function numberOrZero(value) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function firstValue(record, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = record?.[fieldName];

    if (hasValue(value)) {
      return value;
    }
  }

  return "";
}

function normalizeDateValue(value) {
  return hasValue(value) ? String(value).slice(0, 10) : "";
}

function getCleanupBusinessDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/New_York",
    year: "numeric",
  }).formatToParts(new Date());
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;

  return day && month && year
    ? `${year}-${month}-${day}`
    : getTodayDateValue();
}

function getRecordTime(record, fieldName) {
  const value = record?.[fieldName];
  const time = value ? new Date(value).getTime() : Number.NaN;

  return Number.isFinite(time) ? time : 0;
}

function compareNewestSale(firstSale, secondSale) {
  return ["sale_date", "created_at"].reduce(
    (difference, fieldName) =>
      difference ||
      getRecordTime(secondSale, fieldName) -
        getRecordTime(firstSale, fieldName),
    0
  );
}

function compareNewestWarranty(firstWarranty, secondWarranty) {
  return ["updated_at", "created_at"].reduce(
    (difference, fieldName) =>
      difference ||
      getRecordTime(secondWarranty, fieldName) -
        getRecordTime(firstWarranty, fieldName),
    0
  );
}

function compareNewestPrebooking(firstPrebooking, secondPrebooking) {
  return ["updated_at", "created_at"].reduce(
    (difference, fieldName) =>
      difference ||
      getRecordTime(secondPrebooking, fieldName) -
        getRecordTime(firstPrebooking, fieldName),
    0
  );
}

function firstNonBlankValue(record, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = record?.[fieldName];

    if (
      hasValue(value) &&
      (typeof value !== "string" || value.trim().length > 0)
    ) {
      return value;
    }
  }

  return "";
}

function enrichSaleCustomerFields(sale, prebooking) {
  if (!sale || !prebooking) {
    return sale;
  }

  const customerName = firstNonBlankValue(sale, [
    "customer_name",
    "buyer_name",
    "customer",
  ]);
  const customerPhone = firstNonBlankValue(sale, [
    "customer_phone",
    "buyer_phone",
    "phone",
  ]);
  const customerEmail = firstNonBlankValue(sale, [
    "customer_email",
    "buyer_email",
    "email",
  ]);

  return {
    ...sale,
    customer_name:
      customerName ||
      firstNonBlankValue(prebooking, ["customer_name"]),
    customer_phone:
      customerPhone ||
      firstNonBlankValue(prebooking, ["customer_phone"]),
    customer_email:
      customerEmail ||
      firstNonBlankValue(prebooking, ["customer_email"]),
  };
}

function combineNotes(warranty, sale) {
  const warrantyNotes = getWarrantyNotes(warranty);
  const saleNotes = firstValue(sale, ["notes"]);

  if (warrantyNotes && saleNotes && warrantyNotes !== saleNotes) {
    return `${warrantyNotes} | Sale notes: ${saleNotes}`;
  }

  return warrantyNotes || saleNotes || "";
}

function getVehicleTitle(vehicle) {
  return [vehicle?.year, vehicle?.make, vehicle?.model, vehicle?.trim]
    .filter(hasValue)
    .join(" ");
}

function getVehicleStatusValue(vehicle, sale) {
  if (sale || vehicle?.sale_status === "sold") {
    return "Sold";
  }

  return firstValue(vehicle, ["status", "sale_status"]);
}

async function fetchAllRows(
  tableName,
  { orderColumn = "id", ascending = false } = {}
) {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order(orderColumn, { ascending })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return { data: rows, error };
    }

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < PAGE_SIZE) {
      return { data: rows, error: null };
    }
  }
}

async function fetchAppliedPrebookings() {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("vehicle_prebookings")
      .select(
        "id, vehicle_id, customer_name, customer_phone, customer_email, status, created_at, updated_at"
      )
      .eq("status", "applied_to_sale")
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return { data: rows, error };
    }

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < PAGE_SIZE) {
      return { data: rows, error: null };
    }
  }
}

export function buildWarrantyRegisterRecords({
  investmentSummaries = [],
  prebookings = [],
  returnDeductionsByVehicleId = {},
  sales = [],
  vehicles = [],
  warranties = [],
} = {}) {
  const sortedSales = [...sales].sort(compareNewestSale);
  const sortedWarranties = [...warranties].sort(compareNewestWarranty);
  const sortedPrebookings = [...prebookings].sort(compareNewestPrebooking);
  const salesByVehicleId = new Map();
  const warrantiesBySaleId = new Map();
  const prebookingsByVehicleId = new Map();
  const vehicleIdsWithCurrentCoverage = new Set();
  const vehicleIdBySaleId = new Map();
  const cleanupBusinessDate = getCleanupBusinessDate();

  for (const sale of sortedSales) {
    if (sale?.id && sale?.vehicle_id) {
      vehicleIdBySaleId.set(sale.id, sale.vehicle_id);
    }

    if (sale?.vehicle_id && !salesByVehicleId.has(sale.vehicle_id)) {
      salesByVehicleId.set(sale.vehicle_id, sale);
    }
  }

  for (const warranty of sortedWarranties) {
    if (warranty?.sale_id && !warrantiesBySaleId.has(warranty.sale_id)) {
      warrantiesBySaleId.set(warranty.sale_id, warranty);
    }

    const coveredVehicleId = vehicleIdBySaleId.get(warranty?.sale_id);
    const coverageStatus = getWarrantyStatus(
      getWarrantyEndDate(warranty),
      cleanupBusinessDate
    );

    if (
      coveredVehicleId &&
      ["active", "expiring"].includes(coverageStatus.key)
    ) {
      vehicleIdsWithCurrentCoverage.add(coveredVehicleId);
    }
  }

  for (const prebooking of sortedPrebookings) {
    if (
      prebooking?.vehicle_id &&
      prebooking.status === "applied_to_sale" &&
      !prebookingsByVehicleId.has(prebooking.vehicle_id)
    ) {
      prebookingsByVehicleId.set(prebooking.vehicle_id, prebooking);
    }
  }

  const summariesByVehicleId = new Map();
  const summariesByStockNumber = new Map();

  for (const summary of investmentSummaries) {
    if (summary?.vehicle_id) {
      summariesByVehicleId.set(summary.vehicle_id, summary);
    }

    if (summary?.stock_number) {
      summariesByStockNumber.set(String(summary.stock_number), summary);
    }
  }

  const vehiclesById = new Map(
    vehicles.filter((vehicle) => vehicle?.id).map((vehicle) => [vehicle.id, vehicle])
  );
  const vehicleIds = new Set([
    ...vehicles
      .filter(
        (vehicle) =>
          vehicle?.sale_status === "sold" ||
          String(vehicle?.status ?? "").toLowerCase() === "sold"
      )
      .map((vehicle) => vehicle.id),
    ...salesByVehicleId.keys(),
  ]);

  return [...vehicleIds]
    .map((vehicleId) => {
      const vehicle = vehiclesById.get(vehicleId) ?? { id: vehicleId };
      const sale = enrichSaleCustomerFields(
        salesByVehicleId.get(vehicleId) ?? null,
        prebookingsByVehicleId.get(vehicleId) ?? null
      );
      const warranty = sale
        ? warrantiesBySaleId.get(sale.id) ?? null
        : null;
      const endDate = getWarrantyEndDate(warranty);
      const cleanupStatus = getWarrantyStatus(
        endDate,
        cleanupBusinessDate
      );
      const investmentSummary =
        summariesByVehicleId.get(vehicleId) ??
        summariesByStockNumber.get(String(vehicle.stock_number ?? "")) ??
        null;
      const rawTotalInvestment = firstValue(investmentSummary, [
        "total_invested",
        "total_investment",
      ]);
      const totalInvestment = hasValue(rawTotalInvestment)
        ? Math.max(
            numberOrZero(rawTotalInvestment) -
              numberOrZero(returnDeductionsByVehicleId[vehicleId]),
            0
          )
        : "";
      const isExpiredCleanupEligible =
        String(vehicle?.sale_status ?? "").trim().toLowerCase() === "sold" &&
        Boolean(sale?.id) &&
        Boolean(warranty?.id) &&
        cleanupStatus.key === "expired" &&
        !vehicleIdsWithCurrentCoverage.has(vehicleId);

      return {
        endDate,
        investmentSummary,
        isExpiredCleanupEligible,
        sale,
        status: cleanupStatus,
        totalInvestment,
        vehicle,
        vehicleId,
        vehicleTitle: getVehicleTitle(vehicle) || "Untitled vehicle",
        warranty,
      };
    })
    .sort((firstRecord, secondRecord) => {
      const firstEndDate = firstRecord.endDate || "9999-12-31";
      const secondEndDate = secondRecord.endDate || "9999-12-31";

      return (
        firstEndDate.localeCompare(secondEndDate) ||
        String(firstRecord.vehicle?.stock_number ?? "").localeCompare(
          String(secondRecord.vehicle?.stock_number ?? ""),
          undefined,
          { numeric: true }
        )
      );
    });
}

export async function fetchWarrantyRegisterData({
  includeInvestment = false,
} = {}) {
  const [
    vehiclesResponse,
    salesResponse,
    warrantiesResponse,
    prebookingsResponse,
    investmentResponse,
  ] = await Promise.all([
    fetchAllRows("vehicles"),
    fetchAllRows("sales", { orderColumn: "created_at" }),
    fetchAllRows("warranties", { orderColumn: "created_at" }),
    fetchAppliedPrebookings(),
    includeInvestment
      ? fetchAllRows("vehicle_financial_summary", {
          ascending: true,
          orderColumn: "stock_number",
        })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const error =
    vehiclesResponse.error ??
    salesResponse.error ??
    warrantiesResponse.error;

  if (error) {
    return { data: null, error, warning: null };
  }

  const warnings = [];

  if (investmentResponse.error) {
    warnings.push("Total investment could not be loaded and will be left blank.");
  }

  if (prebookingsResponse.error) {
    warnings.push(
      "Applied prebooking customer details could not be loaded; missing customer fields will be left blank."
    );
  }

  return {
    data: buildWarrantyRegisterRecords({
      investmentSummaries: investmentResponse.error
        ? []
        : investmentResponse.data,
      prebookings: prebookingsResponse.error
        ? []
        : prebookingsResponse.data,
      sales: salesResponse.data,
      vehicles: vehiclesResponse.data,
      warranties: warrantiesResponse.data,
    }),
    error: null,
    warning: warnings.join(" "),
  };
}

export function getWarrantyRegisterRow(record) {
  const { sale, status, totalInvestment, vehicle, warranty } = record;
  const warrantyMonths = getWarrantyMonths(warranty);

  return [
    firstValue(vehicle, ["stock_number"]),
    firstValue(vehicle, ["vin"]),
    firstValue(vehicle, ["year"]),
    firstValue(vehicle, ["make"]),
    firstValue(vehicle, ["model"]),
    firstValue(vehicle, ["trim"]),
    firstValue(vehicle, ["color"]),
    firstValue(vehicle, ["mileage"]),
    getVehicleStatusValue(vehicle, sale),
    normalizeDateValue(firstValue(sale, ["sale_date", "sold_at", "created_at"])),
    firstValue(sale, ["customer_name", "buyer_name", "customer"]),
    firstValue(sale, ["customer_phone", "buyer_phone", "phone"]),
    firstValue(sale, ["customer_email", "buyer_email", "email"]),
    firstValue(sale, ["sale_price", "sold_price"]),
    normalizeDateValue(getWarrantyStartDate(warranty)),
    warrantyMonths ?? "",
    normalizeDateValue(getWarrantyEndDate(warranty)),
    warranty ? status.label : "",
    totalInvestment,
    combineNotes(warranty, sale),
  ];
}

export function escapeCsvValue(value) {
  if (!hasValue(value)) {
    return "";
  }

  const rawStringValue = String(value);
  const stringValue =
    typeof value === "string" && /^[=+\-@]/.test(value.trimStart())
      ? `'${rawStringValue}`
      : rawStringValue;

  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function createWarrantyRegisterCsv(records) {
  return [
    WARRANTY_REGISTER_COLUMNS,
    ...records.map(getWarrantyRegisterRow),
  ]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");
}

export function getExpiredWarrantyRow(record) {
  return getWarrantyRegisterRow(record).filter(
    (_, columnIndex) =>
      WARRANTY_REGISTER_COLUMNS[columnIndex] !== "Vehicle Status"
  );
}

function hashArchiveFingerprint(value) {
  let firstHash = 2166136261;
  let secondHash = 3339675911;

  for (let index = 0; index < value.length; index += 1) {
    const characterCode = value.charCodeAt(index);
    firstHash = Math.imul(firstHash ^ characterCode, 16777619);
    secondHash = Math.imul(secondHash ^ characterCode, 2246822519);
  }

  return [firstHash, secondHash]
    .map((hash) => (hash >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

export function getVehicleArchiveRecordFingerprint(record) {
  const fingerprintValue = JSON.stringify({
    archiveRow: getExpiredWarrantyRow(record).map((value) =>
      hasValue(value) ? String(value) : ""
    ),
    saleId: String(record?.sale?.id ?? ""),
    vehicleId: String(record?.vehicleId ?? ""),
    warrantyId: String(record?.warranty?.id ?? ""),
  });

  return `archive-v1-${hashArchiveFingerprint(fingerprintValue)}`;
}

export function createVehicleArchiveCsv(records) {
  return [
    VEHICLE_ARCHIVE_COLUMNS,
    ...records.map(getExpiredWarrantyRow),
  ]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");
}

export function createExpiredWarrantyCsv(records) {
  return createVehicleArchiveCsv(records);
}

export function downloadCsvFile(csv, filename) {
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
}

export function getWarrantyRegisterFilename(today = getTodayDateValue()) {
  return `makkah-warranty-register-${today}.csv`;
}

export function getExpiredWarrantyFilename(today = getTodayDateValue()) {
  return getVehicleArchiveFilename(today);
}

export function getVehicleArchiveFilename(today = getTodayDateValue()) {
  return `makkah-vehicle-archive-${today}.csv`;
}
