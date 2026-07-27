import { useCallback, useEffect, useMemo, useState } from "react";
import AppIcon from "../components/ui/AppIcon";
import WarrantyStatusBadge from "../components/WarrantyStatusBadge";
import { buttonClassNames } from "../components/ui/uiStyles";
import { isAdminOrManagerRole } from "../lib/permissions";
import { formatWarrantyDate } from "../lib/warranty";
import {
  createWarrantyRegisterCsv,
  downloadCsvFile,
  fetchWarrantyRegisterData,
  getExpiredWarrantyFilename,
  getWarrantyRegisterFilename,
} from "../lib/warrantyRegister";

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

function ExpiredWarrantyCard({ isDownloading, onDownloadRegister, record }) {
  const { endDate, sale, status, vehicle, vehicleTitle } = record;
  const stockVin = [
    vehicle?.stock_number ? `Stock ${vehicle.stock_number}` : "",
    vehicle?.vin ? `VIN ${vehicle.vin}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate font-black text-slate-950">{vehicleTitle}</h3>
          <p className="mt-1 break-words text-xs font-semibold text-slate-500">
            {stockVin || "Stock and VIN not recorded"}
          </p>
        </div>
        <WarrantyStatusBadge status={status} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold text-slate-400">
            Warranty End Date
          </dt>
          <dd className="mt-1 font-bold text-slate-800">
            {formatWarrantyDate(endDate)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">Customer</dt>
          <dd className="mt-1 font-bold text-slate-800">
            {getCustomerName(sale)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          className={buttonClassNames.secondary}
          disabled={isDownloading}
          onClick={onDownloadRegister}
          type="button"
        >
          <AppIcon name="file" size={17} />
          Download Warranty Register
        </button>
        <button
          className="inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-400"
          disabled
          title="Vehicle cleanup will be added in the next step."
          type="button"
        >
          Delete From App — Coming Next
        </button>
      </div>
    </article>
  );
}

function ReportsPage({ currentProfile }) {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadType, setDownloadType] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const canViewReports = isAdminOrManagerRole(currentProfile?.role);

  const loadReportRecords = useCallback(async () => {
    if (!canViewReports) {
      setRecords([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setWarningMessage("");

    try {
      const { data, error, warning } = await fetchWarrantyRegisterData({
        includeInvestment: true,
      });

      if (error) {
        console.error("Could not load warranty reports:", error);
        setRecords([]);
        setErrorMessage("Could not load warranty report data. Please try again.");
        return;
      }

      setRecords(data ?? []);
      setWarningMessage(warning ?? "");
    } catch (error) {
      console.error("Could not load warranty reports:", error);
      setRecords([]);
      setErrorMessage("Could not load warranty report data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [canViewReports]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialReportRecords() {
      if (!canViewReports) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      setWarningMessage("");

      try {
        const { data, error, warning } = await fetchWarrantyRegisterData({
          includeInvestment: true,
        });

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("Could not load warranty reports:", error);
          setRecords([]);
          setErrorMessage(
            "Could not load warranty report data. Please try again."
          );
          return;
        }

        setRecords(data ?? []);
        setWarningMessage(warning ?? "");
      } catch (error) {
        if (isMounted) {
          console.error("Could not load warranty reports:", error);
          setRecords([]);
          setErrorMessage(
            "Could not load warranty report data. Please try again."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialReportRecords();

    return () => {
      isMounted = false;
    };
  }, [canViewReports]);

  const expiredRecords = useMemo(
    () => records.filter((record) => record.status.key === "expired"),
    [records]
  );

  async function handleDownload(type) {
    if (!canViewReports || downloadType) {
      return;
    }

    setDownloadType(type);
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
      const exportRecords =
        type === "expired"
          ? currentRecords.filter((record) => record.status.key === "expired")
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
        createWarrantyRegisterCsv(exportRecords),
        type === "expired"
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
          label="Download Expired Warranty Vehicles"
          onDownload={() => handleDownload("expired")}
          recordCount={expiredRecords.length}
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">
              Cleanup Preparation
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Expired Warranty Vehicles
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Review only. No vehicle records are deleted in this step.
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
                onDownloadRegister={() => handleDownload("all")}
                record={record}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default ReportsPage;
