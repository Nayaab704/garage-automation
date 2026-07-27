import { supabase } from "./supabaseClient";
import { getPurchaseOrderReturnDeduction } from "./partReturns";
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

export function buildWarrantyRegisterRecords({
  investmentSummaries = [],
  returnDeductionsByVehicleId = {},
  sales = [],
  vehicles = [],
  warranties = [],
} = {}) {
  const sortedSales = [...sales].sort(compareNewestSale);
  const sortedWarranties = [...warranties].sort(compareNewestWarranty);
  const salesByVehicleId = new Map();
  const warrantiesBySaleId = new Map();

  for (const sale of sortedSales) {
    if (sale?.vehicle_id && !salesByVehicleId.has(sale.vehicle_id)) {
      salesByVehicleId.set(sale.vehicle_id, sale);
    }
  }

  for (const warranty of sortedWarranties) {
    if (warranty?.sale_id && !warrantiesBySaleId.has(warranty.sale_id)) {
      warrantiesBySaleId.set(warranty.sale_id, warranty);
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
      const sale = salesByVehicleId.get(vehicleId) ?? null;
      const warranty = sale
        ? warrantiesBySaleId.get(sale.id) ?? null
        : null;
      const endDate = getWarrantyEndDate(warranty);
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

      return {
        endDate,
        investmentSummary,
        sale,
        status: getWarrantyStatus(endDate),
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
    investmentResponse,
    purchaseOrdersResponse,
    purchaseOrderItemsResponse,
  ] = await Promise.all([
    fetchAllRows("vehicles"),
    fetchAllRows("sales", { orderColumn: "created_at" }),
    fetchAllRows("warranties", { orderColumn: "created_at" }),
    includeInvestment
      ? fetchAllRows("vehicle_investment_summary", {
          ascending: true,
          orderColumn: "stock_number",
        })
      : Promise.resolve({ data: [], error: null }),
    includeInvestment
      ? fetchAllRows("purchase_orders")
      : Promise.resolve({ data: [], error: null }),
    includeInvestment
      ? fetchAllRows("purchase_order_items")
      : Promise.resolve({ data: [], error: null }),
  ]);
  const error =
    vehiclesResponse.error ??
    salesResponse.error ??
    warrantiesResponse.error;

  if (error) {
    return { data: null, error, warning: null };
  }

  const purchaseOrdersById = new Map(
    (purchaseOrdersResponse.data ?? []).map((purchaseOrder) => [
      purchaseOrder.id,
      purchaseOrder,
    ])
  );
  const returnDeductionsByVehicleId = (
    purchaseOrderItemsResponse.data ?? []
  ).reduce((deductions, item) => {
    const vehicleId = purchaseOrdersById.get(item.purchase_order_id)?.vehicle_id;

    if (!vehicleId) {
      return deductions;
    }

    deductions[vehicleId] =
      numberOrZero(deductions[vehicleId]) +
      getPurchaseOrderReturnDeduction([item]);
    return deductions;
  }, {});
  const warnings = [];

  if (investmentResponse.error) {
    warnings.push("Total investment could not be loaded and will be left blank.");
  }

  if (purchaseOrdersResponse.error || purchaseOrderItemsResponse.error) {
    warnings.push(
      "Returned-part deductions could not be loaded; investment totals may be overstated."
    );
  }

  return {
    data: buildWarrantyRegisterRecords({
      investmentSummaries: investmentResponse.error
        ? []
        : investmentResponse.data,
      returnDeductionsByVehicleId,
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
  return `makkah-expired-warranty-vehicles-${today}.csv`;
}
