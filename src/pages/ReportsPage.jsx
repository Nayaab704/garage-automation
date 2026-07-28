import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExpiredWarrantyDeleteModal from "../components/ExpiredWarrantyDeleteModal";
import AppIcon from "../components/ui/AppIcon";
import WarrantyStatusBadge from "../components/WarrantyStatusBadge";
import { buttonClassNames } from "../components/ui/uiStyles";
import { isAdminOrManagerRole } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";
import { formatWarrantyDate, getTodayDateValue } from "../lib/warranty";
import {
  createVehicleArchiveCsv,
  downloadCsvFile,
  escapeCsvValue,
  fetchWarrantyRegisterData,
  getVehicleArchiveFilename,
  getVehicleArchiveRecordFingerprint,
} from "../lib/warrantyRegister";

const EXPORTED_RECORD_KEYS_SESSION_KEY =
  "makkah-expired-warranty-export-keys-v2";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});
const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const salesMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});
const SALES_MONTH_PATTERN = /^(\d{4})-(\d{2})-\d{2}$/;

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function formatCurrency(value) {
  if (!hasValue(value)) {
    return "Not recorded";
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? currencyFormatter.format(numberValue)
    : "Not recorded";
}

function getCustomerName(sale) {
  return (
    sale?.customer_name ||
    sale?.buyer_name ||
    sale?.customer ||
    "Customer not recorded"
  );
}

function formatSalesMonth(value) {
  const match = SALES_MONTH_PATTERN.exec(String(value ?? ""));
  const month = Number(match?.[2]);
  const year = Number(match?.[1]);

  if (!match || month < 1 || month > 12 || !Number.isInteger(year)) {
    return "";
  }

  return salesMonthFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
}

function getCurrentSalesYear(now = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
  }).format(now);
}

function normalizeSalesHistoryRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      month_start: String(row?.month_start ?? "").slice(0, 10),
      sold_count: Number.isFinite(Number(row?.sold_count))
        ? Math.max(0, Math.trunc(Number(row.sold_count)))
        : 0,
    }))
    .filter((row) => formatSalesMonth(row.month_start))
    .sort((firstRow, secondRow) =>
      secondRow.month_start.localeCompare(firstRow.month_start)
    );
}

async function fetchSalesHistoryRows() {
  const { data, error } = await supabase
    .from("vehicle_sales_monthly_summary")
    .select("month_start, sold_count")
    .order("month_start", { ascending: false });

  return {
    data: error ? [] : normalizeSalesHistoryRows(data),
    error,
  };
}

function createSalesSummaryCsv(rows) {
  return [
    ["Month", "Vehicles Sold"],
    ...rows.map((row) => [
      formatSalesMonth(row.month_start),
      row.sold_count,
    ]),
  ]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");
}

function getSalesSummaryFilename(today = getTodayDateValue()) {
  return `makkah-sales-summary-${today}.csv`;
}

function getRecordExportKey(record, profileId) {
  return `${String(profileId ?? "unknown")}:${getVehicleArchiveRecordFingerprint(
    record
  )}`;
}

function getExportStorageKey(profileId) {
  return `${EXPORTED_RECORD_KEYS_SESSION_KEY}:${String(
    profileId ?? "unknown"
  )}`;
}

function readStoredExportKeys(profileId) {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const storedKeys = JSON.parse(
      window.sessionStorage.getItem(getExportStorageKey(profileId)) ?? "[]"
    );

    return new Set(
      Array.isArray(storedKeys)
        ? storedKeys.filter((key) => typeof key === "string" && key)
        : []
    );
  } catch {
    return new Set();
  }
}

function persistExportKeys(keys, profileId) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getExportStorageKey(profileId),
      JSON.stringify([...keys])
    );
  } catch {
    // A blocked session store should not block CSV export or safe deletion.
  }
}

function ArchiveExportCard({
  disabled,
  isDownloaded,
  isDownloading,
  onDownload,
  recordCount,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <AppIcon name="file" size={21} />
        </span>
        <div className="min-w-0">
          <h2 className="font-black text-slate-950">Download Archive CSV</h2>
          <p className="mt-1 text-xs font-bold tabular-nums text-slate-400">
            {recordCount} {recordCount === 1 ? "vehicle" : "vehicles"}
            {" not yet exported"}
          </p>
        </div>
      </div>
      <button
        className={`${buttonClassNames.primary} mt-4 w-full`}
        disabled={disabled}
        onClick={onDownload}
        type="button"
      >
        <AppIcon name="file" size={18} />
        {isDownloading
          ? "Preparing Archive CSV..."
          : isDownloaded
            ? "Archive CSV Downloaded"
            : "Download Archive CSV"}
      </button>
      {isDownloaded && (
        <p className="mt-2 text-center text-xs font-semibold text-emerald-700">
          Delete is enabled for the exact vehicles in this file.
        </p>
      )}
    </article>
  );
}

function ExpiredWarrantyCard({
  canDelete,
  isDownloading,
  onDelete,
  record,
}) {
  const { endDate, sale, status, vehicle, vehicleTitle } = record;
  const stockVin = [
    vehicle?.stock_number ? `Stock ${vehicle.stock_number}` : "",
    vehicle?.vin ? `VIN ${vehicle.vin}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const expiredWarrantyStatus = {
    ...status,
    label: "Expired Warranty",
  };

  return (
    <article className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate font-black text-slate-950">{vehicleTitle}</h3>
          <p className="mt-1 break-words text-xs font-semibold text-slate-500">
            {stockVin || "Stock and VIN not recorded"}
          </p>
        </div>
        <WarrantyStatusBadge status={expiredWarrantyStatus} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold text-slate-400">Customer</dt>
          <dd className="mt-1 font-bold text-slate-800">
            {getCustomerName(sale)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">Sold Date</dt>
          <dd className="mt-1 font-bold text-slate-800">
            {formatWarrantyDate(sale?.sale_date || sale?.created_at)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">
            Warranty End Date
          </dt>
          <dd className="mt-1 font-bold text-slate-800">
            {formatWarrantyDate(endDate)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">Sale Price</dt>
          <dd className="mt-1 font-bold text-slate-800">
            {formatCurrency(sale?.sale_price)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">
            Total Investment
          </dt>
          <dd className="mt-1 font-bold text-slate-800">
            {hasValue(record.totalInvestment)
              ? formatCurrency(record.totalInvestment)
              : "Not available"}
          </dd>
        </div>
      </dl>

      <button
        className={`${buttonClassNames.danger} mt-4 w-full`}
        disabled={!canDelete || isDownloading}
        onClick={onDelete}
        title={
          canDelete
            ? "Delete this exported expired vehicle from the app."
            : "Download the Archive CSV before deleting."
        }
        type="button"
      >
        Delete From App
      </button>
      {!canDelete && (
        <p className="mt-2 text-center text-xs font-semibold text-slate-500">
          Download Archive CSV to enable deletion.
        </p>
      )}
    </article>
  );
}

function SalesHistoryMetric({ className = "", label, value }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white px-3 py-2.5 ${className}`}
    >
      <dt className="text-[0.65rem] font-black uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 truncate text-lg font-black tabular-nums text-slate-950">
        {value}
      </dd>
    </div>
  );
}

function SalesHistorySection({
  errorMessage,
  isDownloading,
  isLoading,
  onDownload,
  rows,
  stats,
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
            Sales History
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            Monthly Sold Summary
          </h2>
        </div>
        <button
          className={`${buttonClassNames.secondary} w-full sm:w-auto`}
          disabled={isLoading || isDownloading || rows.length === 0}
          onClick={onDownload}
          type="button"
        >
          <AppIcon name="file" size={18} />
          {isDownloading ? "Preparing CSV..." : "Download Sales Summary CSV"}
        </button>
      </div>

      {!isLoading && (!errorMessage || rows.length > 0) && (
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <SalesHistoryMetric
            label="Total Vehicles Sold"
            value={integerFormatter.format(stats.totalVehiclesSold)}
          />
          <SalesHistoryMetric
            label="Sold This Year"
            value={integerFormatter.format(stats.soldThisYear)}
          />
          <SalesHistoryMetric
            className="col-span-2 sm:col-span-1"
            label="First Sale Month"
            value={formatSalesMonth(stats.firstSaleMonth) || "Not available"}
          />
        </dl>
      )}

      {!isLoading && errorMessage && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <p className="text-sm font-semibold text-slate-500">
            Loading sales history...
          </p>
        </div>
      ) : errorMessage && rows.length === 0 ? null : rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-slate-500">
            No sales history yet.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5" scope="col">
                  Month
                </th>
                <th className="px-3 py-2.5 text-right" scope="col">
                  Vehicles Sold
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.month_start}>
                  <td className="px-3 py-2.5 font-bold text-slate-800">
                    {formatSalesMonth(row.month_start)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-black tabular-nums text-slate-950">
                    {integerFormatter.format(row.sold_count)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ReportsPage({ currentProfile }) {
  const [records, setRecords] = useState([]);
  const [salesHistoryRows, setSalesHistoryRows] = useState([]);
  const [exportedRecordKeys, setExportedRecordKeys] = useState(
    () => readStoredExportKeys(currentProfile?.id)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSalesHistoryLoading, setIsSalesHistoryLoading] = useState(true);
  const [isSalesHistoryDownloading, setIsSalesHistoryDownloading] =
    useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [salesHistoryErrorMessage, setSalesHistoryErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [selectedDeleteRecord, setSelectedDeleteRecord] = useState(null);
  const cleanupSectionRef = useRef(null);
  const hasFocusedCleanupRef = useRef(false);
  const canViewReports = isAdminOrManagerRole(currentProfile?.role);

  const loadReportRecords = useCallback(async () => {
    if (!canViewReports) {
      setRecords([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setInfoMessage("");
    setWarningMessage("");

    try {
      const { data, error, warning } = await fetchWarrantyRegisterData({
        includeInvestment: true,
      });

      if (error) {
        console.error("Could not load warranty cleanup report:", error);
        setRecords([]);
        setErrorMessage("Could not load expired warranty data. Please try again.");
        return;
      }

      const currentRecords = data ?? [];
      const eligibleRecordKeys = new Set(
        currentRecords
          .filter((record) => record.isExpiredCleanupEligible)
          .map((record) =>
            getRecordExportKey(record, currentProfile?.id)
          )
      );

      setRecords(currentRecords);
      setExportedRecordKeys((currentKeys) => {
        const nextKeys = new Set(
          [...currentKeys].filter((key) => eligibleRecordKeys.has(key))
        );
        persistExportKeys(nextKeys, currentProfile?.id);
        return nextKeys;
      });
      setWarningMessage(warning ?? "");
    } catch (error) {
      console.error("Could not load warranty cleanup report:", error);
      setRecords([]);
      setErrorMessage("Could not load expired warranty data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [canViewReports, currentProfile?.id]);

  const loadSalesHistory = useCallback(async () => {
    if (!canViewReports) {
      setSalesHistoryRows([]);
      setSalesHistoryErrorMessage("");
      setIsSalesHistoryLoading(false);
      return;
    }

    setIsSalesHistoryLoading(true);
    setSalesHistoryErrorMessage("");

    try {
      const { data, error } = await fetchSalesHistoryRows();

      if (error) {
        console.error("Could not load monthly sales history:", error);
        setSalesHistoryRows([]);
        setSalesHistoryErrorMessage(
          "Could not load sales history. Please try again."
        );
        return;
      }

      setSalesHistoryRows(data);
    } catch (error) {
      console.error("Could not load monthly sales history:", error);
      setSalesHistoryRows([]);
      setSalesHistoryErrorMessage(
        "Could not load sales history. Please try again."
      );
    } finally {
      setIsSalesHistoryLoading(false);
    }
  }, [canViewReports]);

  const refreshReports = useCallback(() => {
    loadReportRecords();
    loadSalesHistory();
  }, [loadReportRecords, loadSalesHistory]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      refreshReports();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshReports]);

  useEffect(() => {
    if (
      isLoading ||
      isSalesHistoryLoading ||
      hasFocusedCleanupRef.current ||
      typeof window === "undefined" ||
      new URLSearchParams(window.location.search).get("tab") !== "expired"
    ) {
      return;
    }

    hasFocusedCleanupRef.current = true;
    cleanupSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [isLoading, isSalesHistoryLoading]);

  const expiredRecords = useMemo(
    () => records.filter((record) => record.isExpiredCleanupEligible),
    [records]
  );
  const unexportedExpiredRecords = useMemo(
    () =>
      expiredRecords.filter(
        (record) =>
          !exportedRecordKeys.has(
            getRecordExportKey(record, currentProfile?.id)
          )
      ),
    [currentProfile?.id, expiredRecords, exportedRecordKeys]
  );
  const salesHistoryStats = useMemo(() => {
    const currentYear = getCurrentSalesYear();

    return {
      firstSaleMonth: salesHistoryRows.reduce((firstMonth, row) => {
        if (
          row.sold_count <= 0 ||
          (firstMonth && row.month_start >= firstMonth)
        ) {
          return firstMonth;
        }

        return row.month_start;
      }, ""),
      soldThisYear: salesHistoryRows
        .filter((row) => row.month_start.startsWith(`${currentYear}-`))
        .reduce((total, row) => total + row.sold_count, 0),
      totalVehiclesSold: salesHistoryRows.reduce(
        (total, row) => total + row.sold_count,
        0
      ),
    };
  }, [salesHistoryRows]);

  async function handleDownloadSalesSummary() {
    if (!canViewReports || isSalesHistoryDownloading) {
      return;
    }

    setIsSalesHistoryDownloading(true);
    setSalesHistoryErrorMessage("");

    try {
      const { data, error } = await fetchSalesHistoryRows();

      if (error) {
        console.error("Could not prepare monthly sales summary CSV:", error);
        setSalesHistoryErrorMessage(
          "Could not download the sales summary. Please try again."
        );
        return;
      }

      setSalesHistoryRows(data);

      if (data.length === 0) {
        return;
      }

      downloadCsvFile(createSalesSummaryCsv(data), getSalesSummaryFilename());
    } catch (error) {
      console.error("Could not prepare monthly sales summary CSV:", error);
      setSalesHistoryErrorMessage(
        "Could not download the sales summary. Please try again."
      );
    } finally {
      setIsSalesHistoryDownloading(false);
    }
  }

  async function handleDownloadArchive() {
    if (!canViewReports || isDownloading) {
      return;
    }

    setIsDownloading(true);
    setErrorMessage("");
    setInfoMessage("");
    setWarningMessage("");

    try {
      const { data, error, warning } = await fetchWarrantyRegisterData({
        includeInvestment: true,
      });

      if (error) {
        console.error("Could not prepare vehicle archive CSV:", error);
        setErrorMessage("Could not prepare the Archive CSV. Please try again.");
        return;
      }

      const currentRecords = data ?? [];
      const currentExpiredRecords = currentRecords.filter(
        (record) => record.isExpiredCleanupEligible
      );
      const currentEligibleKeys = new Set(
        currentExpiredRecords.map((record) =>
          getRecordExportKey(record, currentProfile?.id)
        )
      );
      const stillExportedKeys = new Set(
        [...exportedRecordKeys].filter((key) =>
          currentEligibleKeys.has(key)
        )
      );
      const recordsToExport = currentExpiredRecords.filter(
        (record) =>
          !stillExportedKeys.has(
            getRecordExportKey(record, currentProfile?.id)
          )
      );

      setRecords(currentRecords);
      setWarningMessage(warning ?? "");

      if (warning) {
        setErrorMessage(
          "The Archive CSV was not downloaded because some report details could not be verified. Refresh and try again."
        );
        return;
      }

      if (recordsToExport.length === 0) {
        setExportedRecordKeys(stillExportedKeys);
        persistExportKeys(stillExportedKeys, currentProfile?.id);
        setInfoMessage(
          currentExpiredRecords.length === 0
            ? "There are no expired warranty vehicles to export."
            : "Every current cleanup vehicle is already in this session's Archive CSV."
        );
        return;
      }

      downloadCsvFile(
        createVehicleArchiveCsv(recordsToExport),
        getVehicleArchiveFilename()
      );
      const nextExportedKeys = new Set([
        ...stillExportedKeys,
        ...recordsToExport.map((record) =>
          getRecordExportKey(record, currentProfile?.id)
        ),
      ]);
      setExportedRecordKeys(nextExportedKeys);
      persistExportKeys(nextExportedKeys, currentProfile?.id);
      setInfoMessage(
        `${recordsToExport.length} ${
          recordsToExport.length === 1 ? "vehicle" : "vehicles"
        } saved in the Archive CSV. Delete From App is now enabled for those exact records.`
      );
    } catch (error) {
      console.error("Could not prepare vehicle archive CSV:", error);
      setErrorMessage("Could not prepare the Archive CSV. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  function handleDeleted(result) {
    const deletedVehicleId =
      result?.data?.deleted_vehicle_id ?? selectedDeleteRecord?.vehicleId;
    const deletedStockNumber =
      result?.data?.deleted_stock_number ||
      selectedDeleteRecord?.vehicle?.stock_number ||
      "Vehicle";

    if (deletedVehicleId) {
      setRecords((currentRecords) =>
        currentRecords.filter(
          (record) => record.vehicleId !== deletedVehicleId
        )
      );
    }

    setExportedRecordKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);
      nextKeys.delete(
        getRecordExportKey(selectedDeleteRecord, currentProfile?.id)
      );
      persistExportKeys(nextKeys, currentProfile?.id);
      return nextKeys;
    });
    setSelectedDeleteRecord(null);
    setErrorMessage("");
    setWarningMessage("");
    setInfoMessage(
      `${deletedStockNumber} was deleted from the active app. Lifetime monthly sales totals were kept.`
    );
  }

  if (!canViewReports) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
        Reports are limited to active owners, admins, and managers.
      </section>
    );
  }

  return (
    <div className="space-y-4 text-slate-950">
      <header className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              Admin / Manager
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">
              Reports & Export Center
            </h1>
          </div>
          <button
            className={buttonClassNames.secondary}
            disabled={
              isLoading ||
              isDownloading ||
              isSalesHistoryLoading ||
              isSalesHistoryDownloading
            }
            onClick={refreshReports}
            type="button"
          >
            <AppIcon name="refresh" size={18} />
            Refresh
          </button>
        </div>
      </header>

      {errorMessage && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {errorMessage}
        </section>
      )}
      {warningMessage && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          {warningMessage}
        </section>
      )}
      {infoMessage && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
          {infoMessage}
        </section>
      )}

      <SalesHistorySection
        errorMessage={salesHistoryErrorMessage}
        isDownloading={isSalesHistoryDownloading}
        isLoading={isSalesHistoryLoading}
        onDownload={handleDownloadSalesSummary}
        rows={salesHistoryRows}
        stats={salesHistoryStats}
      />

      <section className="max-w-2xl">
        <ArchiveExportCard
          disabled={
            isLoading ||
            isDownloading ||
            Boolean(warningMessage) ||
            unexportedExpiredRecords.length === 0
          }
          isDownloaded={
            expiredRecords.length > 0 &&
            unexportedExpiredRecords.length === 0
          }
          isDownloading={isDownloading}
          onDownload={handleDownloadArchive}
          recordCount={unexportedExpiredRecords.length}
        />
      </section>

      <section
        className="scroll-mt-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm sm:p-5"
        id="expired-warranty-cleanup"
        ref={cleanupSectionRef}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">
              Storage Cleanup
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Expired Warranty Cleanup
            </h2>
          </div>
          <span className="w-fit rounded-full bg-red-50 px-3 py-1.5 text-sm font-black tabular-nums text-red-700 ring-1 ring-inset ring-red-200">
            {expiredRecords.length}
          </span>
        </div>

        {isLoading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-slate-500">
              Loading expired warranty vehicles...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-white p-6 text-center">
            <p className="text-sm font-semibold text-red-700">
              Expired warranty vehicles are unavailable until the report data
              can be refreshed.
            </p>
          </div>
        ) : expiredRecords.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <AppIcon
              className="mx-auto text-emerald-500"
              name="checklist"
              size={30}
            />
            <h3 className="mt-3 font-black text-slate-800">
              No expired vehicles to clean up
            </h3>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {expiredRecords.map((record) => (
              <ExpiredWarrantyCard
                canDelete={exportedRecordKeys.has(
                  getRecordExportKey(record, currentProfile?.id)
                )}
                isDownloading={isDownloading}
                key={record.vehicleId}
                onDelete={() => setSelectedDeleteRecord(record)}
                record={record}
              />
            ))}
          </div>
        )}
      </section>

      {selectedDeleteRecord && (
        <ExpiredWarrantyDeleteModal
          onClose={() => setSelectedDeleteRecord(null)}
          onDeleted={handleDeleted}
          record={selectedDeleteRecord}
        />
      )}
    </div>
  );
}

export default ReportsPage;
