import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExpiredWarrantyArchiveModal from "../components/ExpiredWarrantyArchiveModal";
import AppIcon from "../components/ui/AppIcon";
import WarrantyStatusBadge from "../components/WarrantyStatusBadge";
import { buttonClassNames } from "../components/ui/uiStyles";
import { retryArchivedWarrantyStorageCleanup } from "../lib/expiredWarrantyArchive";
import { isAdminOrManagerRole } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";
import { formatWarrantyDate } from "../lib/warranty";
import {
  createExpiredWarrantyCsv,
  createWarrantyRegisterCsv,
  downloadCsvFile,
  fetchWarrantyRegisterData,
  getExpiredWarrantyFilename,
  getWarrantyRegisterFilename,
} from "../lib/warrantyRegister";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});
const ARCHIVE_PAGE_SIZE = 1000;
const ARCHIVE_RECORD_COLUMNS =
  "id, vehicle_id, stock_number, vin, year, make, model, trim, color, mileage, sold_date, customer_name, customer_phone, customer_email, sale_price, warranty_start_date, warranty_months, warranty_end_date, total_investment, archive_reason, archived_by, archived_at, storage_cleanup_status, storage_cleanup_failed_count, storage_cleanup_last_attempt_at";

async function fetchArchiveRecords() {
  const records = [];

  for (let from = 0; ; from += ARCHIVE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("vehicle_archive_records")
      .select(ARCHIVE_RECORD_COLUMNS)
      .eq("archive_reason", "expired_warranty")
      .order("archived_at", { ascending: false })
      .range(from, from + ARCHIVE_PAGE_SIZE - 1);

    if (error) {
      return { data: records, error };
    }

    const pageRecords = data ?? [];
    records.push(...pageRecords);

    if (pageRecords.length < ARCHIVE_PAGE_SIZE) {
      return { data: records, error: null };
    }
  }
}

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

function ExportCard({
  description,
  disabled,
  icon = "file",
  label,
  onDownload,
  recordCount,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <AppIcon name={icon} size={21} />
        </span>
        <div className="min-w-0">
          <h2 className="font-black text-slate-950">{label}</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
          <p className="mt-2 text-xs font-bold tabular-nums text-slate-400">
            {recordCount} {recordCount === 1 ? "vehicle" : "vehicles"}
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
        {disabled ? "Preparing CSV..." : label}
      </button>
    </article>
  );
}

function ExpiredWarrantyCard({
  isDownloading,
  onArchive,
  onDownloadRecord,
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

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          className={buttonClassNames.secondary}
          disabled={isDownloading}
          onClick={onDownloadRecord}
          type="button"
        >
          <AppIcon name="file" size={17} />
          Download Vehicle CSV
        </button>
        <button
          className={buttonClassNames.danger}
          disabled={isDownloading}
          onClick={onArchive}
          type="button"
        >
          Archive & Delete From App
        </button>
      </div>
    </article>
  );
}

function ArchivedRecordCard({ isRetrying, onRetryCleanup, record }) {
  const vehicleTitle =
    [record?.year, record?.make, record?.model, record?.trim]
      .filter(hasValue)
      .join(" ") || "Archived vehicle";
  const stockVin = [
    record?.stock_number ? `Stock ${record.stock_number}` : "",
    record?.vin ? `VIN ${record.vin}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const cleanupStatus = record?.storage_cleanup_status || "pending";
  const cleanupLabel =
    cleanupStatus === "complete"
      ? "Files Clean"
      : cleanupStatus === "partial"
        ? "File Cleanup Partial"
        : "File Cleanup Pending";
  const cleanupBadgeClassName =
    cleanupStatus === "complete"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : "bg-amber-50 text-amber-800 ring-amber-200";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-black text-slate-950">{vehicleTitle}</h3>
          <p className="mt-1 break-words text-xs font-semibold text-slate-500">
            {stockVin || "Stock and VIN not recorded"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-inset ring-slate-200">
            Archived
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[0.68rem] font-bold ring-1 ring-inset ${cleanupBadgeClassName}`}
          >
            {cleanupLabel}
          </span>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold text-slate-400">Customer</dt>
          <dd className="mt-1 font-bold text-slate-800">
            {record?.customer_name || "Not recorded"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">Sold Date</dt>
          <dd className="mt-1 font-bold text-slate-800">
            {formatWarrantyDate(record?.sold_date)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">
            Warranty End
          </dt>
          <dd className="mt-1 font-bold text-slate-800">
            {formatWarrantyDate(record?.warranty_end_date)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">Sale Price</dt>
          <dd className="mt-1 font-bold text-slate-800">
            {formatCurrency(record?.sale_price)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">
            Total Investment
          </dt>
          <dd className="mt-1 font-bold text-slate-800">
            {hasValue(record?.total_investment)
              ? formatCurrency(record.total_investment)
              : "Not available"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">Archived</dt>
          <dd className="mt-1 font-bold text-slate-800">
            {formatWarrantyDate(record?.archived_at)}
          </dd>
        </div>
      </dl>

      {cleanupStatus !== "complete" && (
        <button
          className={`${buttonClassNames.secondary} mt-4 w-full`}
          disabled={isRetrying}
          onClick={onRetryCleanup}
          type="button"
        >
          <AppIcon name="refresh" size={17} />
          {isRetrying ? "Retrying File Cleanup..." : "Retry File Cleanup"}
        </button>
      )}
    </article>
  );
}

function ReportsPage({ currentProfile }) {
  const [records, setRecords] = useState([]);
  const [archiveRecords, setArchiveRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadType, setDownloadType] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [selectedArchiveRecord, setSelectedArchiveRecord] = useState(null);
  const [retryingArchiveId, setRetryingArchiveId] = useState("");
  const cleanupSectionRef = useRef(null);
  const hasFocusedCleanupRef = useRef(false);
  const canViewReports = isAdminOrManagerRole(currentProfile?.role);

  const loadReportRecords = useCallback(async () => {
    if (!canViewReports) {
      setRecords([]);
      setArchiveRecords([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setInfoMessage("");
    setWarningMessage("");

    try {
      const [registerResponse, archiveResponse] = await Promise.all([
        fetchWarrantyRegisterData({ includeInvestment: true }),
        fetchArchiveRecords(),
      ]);
      const warnings = [
        registerResponse.warning,
        archiveResponse.error
          ? "Archived records could not be loaded. Please refresh after confirming the latest database migration is applied."
          : "",
      ].filter(Boolean);

      if (registerResponse.error) {
        console.error(
          "Could not load warranty reports:",
          registerResponse.error
        );
        setRecords([]);
        setErrorMessage("Could not load warranty report data. Please try again.");
      } else {
        setRecords(registerResponse.data ?? []);
      }

      if (archiveResponse.error) {
        console.error(
          "Could not load expired warranty archive records:",
          archiveResponse.error
        );
        setArchiveRecords([]);
      } else {
        setArchiveRecords(archiveResponse.data ?? []);
      }

      setWarningMessage(warnings.join(" "));
    } catch (error) {
      console.error("Could not load warranty reports:", error);
      setRecords([]);
      setArchiveRecords([]);
      setErrorMessage("Could not load warranty report data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [canViewReports]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadReportRecords();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadReportRecords]);

  useEffect(() => {
    if (
      isLoading ||
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
  }, [isLoading]);

  const expiredRecords = useMemo(() => {
    const archivedVehicleIds = new Set(
      archiveRecords.map((record) => record.vehicle_id).filter(Boolean)
    );

    return records.filter(
      (record) =>
        record.status.key === "expired" &&
        !archivedVehicleIds.has(record.vehicleId)
    );
  }, [archiveRecords, records]);

  async function handleDownload(type, vehicleId = null) {
    if (!canViewReports || downloadType) {
      return;
    }

    setDownloadType(vehicleId ? `vehicle-${vehicleId}` : type);
    setErrorMessage("");
    setInfoMessage("");
    setWarningMessage("");

    try {
      const { data, error, warning } = await fetchWarrantyRegisterData({
        includeInvestment: true,
      });

      if (error) {
        console.error("Could not prepare warranty export:", error);
        setErrorMessage("Could not prepare the CSV. Please try again.");
        return;
      }

      const currentRecords = data ?? [];
      const archivedVehicleIds = new Set(
        archiveRecords.map((record) => record.vehicle_id).filter(Boolean)
      );
      const currentExpiredRecords = currentRecords.filter(
        (record) =>
          record.status.key === "expired" &&
          !archivedVehicleIds.has(record.vehicleId)
      );
      const exportRecords = vehicleId
        ? currentExpiredRecords.filter(
            (record) => record.vehicleId === vehicleId
          )
        : type === "expired"
          ? currentExpiredRecords
          : currentRecords;

      setRecords(currentRecords);
      setWarningMessage(warning ?? "");

      if (exportRecords.length === 0) {
        setInfoMessage(
          type === "expired"
            ? "There are no expired warranty vehicles to export."
            : "There are no sold or warranty vehicles to export."
        );
        return;
      }

      downloadCsvFile(
        type === "expired" || vehicleId
          ? createExpiredWarrantyCsv(exportRecords)
          : createWarrantyRegisterCsv(exportRecords),
        type === "expired"
          ? getExpiredWarrantyFilename()
          : vehicleId
            ? getExpiredWarrantyFilename()
            : getWarrantyRegisterFilename()
      );
      setInfoMessage(
        `${exportRecords.length} ${
          exportRecords.length === 1 ? "row" : "rows"
        } downloaded in one CSV file.`
      );
    } catch (error) {
      console.error("Could not prepare warranty export:", error);
      setErrorMessage("Could not prepare the CSV. Please try again.");
    } finally {
      setDownloadType("");
    }
  }

  function handleArchived(result) {
    const deletedVehicleId =
      result?.data?.archived_vehicle_id ?? selectedArchiveRecord?.vehicleId;
    const archivedRecord = result?.data?.archive_record;
    const archivedStockNumber =
      archivedRecord?.stock_number ??
      selectedArchiveRecord?.vehicle?.stock_number ??
      "Vehicle";

    if (deletedVehicleId) {
      setRecords((currentRecords) =>
        currentRecords.filter(
          (record) => record.vehicleId !== deletedVehicleId
        )
      );
    }

    if (archivedRecord?.id) {
      setArchiveRecords((currentRecords) => [
        archivedRecord,
        ...currentRecords.filter(
          (record) => record.id !== archivedRecord.id
        ),
      ]);
    }

    setSelectedArchiveRecord(null);
    setErrorMessage("");
    setInfoMessage(
      `${archivedStockNumber} was archived and removed from the active app.`
    );
    setWarningMessage(result?.storageWarning ?? "");
  }

  async function handleRetryArchiveCleanup(record) {
    if (!record?.vehicle_id || retryingArchiveId) {
      return;
    }

    setRetryingArchiveId(record.id);
    setErrorMessage("");
    setInfoMessage("");
    setWarningMessage("");

    try {
      const result = await retryArchivedWarrantyStorageCleanup({
        vehicleId: record.vehicle_id,
      });

      if (result.error) {
        setErrorMessage(result.error.message);
        return;
      }

      const updatedRecord = result.data?.archive_record;

      if (updatedRecord?.id) {
        setArchiveRecords((currentRecords) =>
          currentRecords.map((currentRecord) =>
            currentRecord.id === updatedRecord.id
              ? updatedRecord
              : currentRecord
          )
        );
      }

      setInfoMessage(
        result.storageWarning
          ? "File cleanup retry finished with items that still need review."
          : "Archived vehicle file cleanup completed."
      );
      setWarningMessage(result.storageWarning ?? "");
    } catch (error) {
      console.error("Could not retry archived vehicle file cleanup:", error);
      setErrorMessage("Could not retry file cleanup. Please try again.");
    } finally {
      setRetryingArchiveId("");
    }
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
            <p className="mt-1 text-sm text-slate-500">
              Download one current master CSV and review warranty cleanup due.
            </p>
          </div>
          <button
            className={buttonClassNames.secondary}
            disabled={isLoading}
            onClick={loadReportRecords}
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

      <section className="grid gap-3 md:grid-cols-2">
        <ExportCard
          description="All sold and warranty vehicles, deduplicated to one row per vehicle."
          disabled={Boolean(downloadType)}
          label="Download Warranty Register"
          onDownload={() => handleDownload("all")}
          recordCount={records.length}
        />
        <ExportCard
          description="Only vehicles whose warranty end date is before today."
          disabled={Boolean(downloadType)}
          icon="warning"
          label="Download Expired Warranty CSV"
          onDownload={() => handleDownload("expired")}
          recordCount={expiredRecords.length}
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
              Confirmed Cleanup
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Expired Warranty Cleanup
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Sold vehicles with warranty dates before today. Nothing is
              archived or deleted automatically.
            </p>
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
              No warranty cleanup due
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Vehicles with old warranty end dates will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {expiredRecords.map((record) => (
              <ExpiredWarrantyCard
                isDownloading={Boolean(downloadType)}
                key={record.vehicleId}
                onArchive={() => setSelectedArchiveRecord(record)}
                onDownloadRecord={() =>
                  handleDownload("expired", record.vehicleId)
                }
                record={record}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Retained Proof Records
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Archived Records
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Compact vehicle, sale, warranty, and financial snapshots kept
              after cleanup.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-black tabular-nums text-slate-700 ring-1 ring-inset ring-slate-200">
            {archiveRecords.length}
          </span>
        </div>

        {isLoading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
            Loading archived records...
          </div>
        ) : archiveRecords.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <h3 className="font-black text-slate-800">
              No archived records yet
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Confirmed expired-warranty cleanups will leave a snapshot here.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {archiveRecords.map((record) => (
              <ArchivedRecordCard
                isRetrying={retryingArchiveId === record.id}
                key={record.id}
                onRetryCleanup={() => handleRetryArchiveCleanup(record)}
                record={record}
              />
            ))}
          </div>
        )}
      </section>

      {selectedArchiveRecord && (
        <ExpiredWarrantyArchiveModal
          onArchived={handleArchived}
          onClose={() => setSelectedArchiveRecord(null)}
          record={selectedArchiveRecord}
        />
      )}
    </div>
  );
}

export default ReportsPage;
