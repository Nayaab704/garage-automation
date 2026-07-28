import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExpiredWarrantyDeleteModal from "../components/ExpiredWarrantyDeleteModal";
import AppIcon from "../components/ui/AppIcon";
import WarrantyStatusBadge from "../components/WarrantyStatusBadge";
import { buttonClassNames } from "../components/ui/uiStyles";
import { isAdminOrManagerRole } from "../lib/permissions";
import { formatWarrantyDate } from "../lib/warranty";
import {
  createVehicleArchiveCsv,
  downloadCsvFile,
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
          <p className="mt-1 text-sm leading-5 text-slate-500">
            One permanent export for the expired vehicles currently awaiting
            deletion.
          </p>
          <p className="mt-2 text-xs font-bold tabular-nums text-slate-400">
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

function ReportsPage({ currentProfile }) {
  const [records, setRecords] = useState([]);
  const [exportedRecordKeys, setExportedRecordKeys] = useState(
    () => readStoredExportKeys(currentProfile?.id)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
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
            <p className="mt-1 text-sm text-slate-500">
              Export expired vehicles once, then remove their heavy app data.
            </p>
          </div>
          <button
            className={buttonClassNames.secondary}
            disabled={isLoading || isDownloading}
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
            <p className="mt-1 text-sm text-slate-500">
              Only sold vehicles with expired coverage and no active warranty
              appear here. Nothing is deleted automatically.
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
              No expired vehicles to clean up
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Sold vehicles will appear here after their warranty end date.
            </p>
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
