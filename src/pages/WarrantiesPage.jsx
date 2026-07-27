import { useCallback, useEffect, useMemo, useState } from "react";
import AppIcon from "../components/ui/AppIcon";
import WarrantyStatusBadge from "../components/WarrantyStatusBadge";
import WarrantyEditorForm from "../components/vehicle-detail/WarrantyEditorForm";
import { buttonClassNames } from "../components/ui/uiStyles";
import { hasPermission } from "../lib/permissions";
import {
  formatWarrantyDate,
  getWarrantyEndDate,
  getWarrantyMonths,
  getWarrantyStartDate,
  getWarrantyStatus,
} from "../lib/warranty";
import { fetchWarrantyRegisterData } from "../lib/warrantyRegister";

const statusFilters = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "expiring", label: "Expiring Soon" },
  { key: "expired", label: "Expired" },
  { key: "none", label: "No Warranty" },
];

function getInitialStatusFilter() {
  if (typeof window === "undefined") {
    return "all";
  }

  const tab = new URLSearchParams(window.location.search).get("tab");

  return statusFilters.some((filter) => filter.key === tab) ? tab : "all";
}

function displayValue(value, fallback = "Not available") {
  return value === null || value === undefined || value === ""
    ? fallback
    : value;
}

function getCustomerName(sale) {
  return (
    sale?.customer_name ||
    sale?.buyer_name ||
    sale?.customer ||
    "Customer not recorded"
  );
}

function isSoldVehicleRecord(record) {
  const saleStatus = String(record?.vehicle?.sale_status ?? "")
    .trim()
    .toLowerCase();

  if (saleStatus) {
    return saleStatus === "sold";
  }

  return (
    Boolean(record?.sale) ||
    String(record?.vehicle?.status ?? "").trim().toLowerCase() === "sold"
  );
}

function WarrantyCard({ canManage, onEdit, record }) {
  const { endDate, sale, status, vehicle, vehicleTitle, warranty } = record;
  const warrantyMonths = getWarrantyMonths(warranty);
  const stockOrVin = [
    vehicle?.stock_number ? `Stock ${vehicle.stock_number}` : "",
    vehicle?.vin ? `VIN ${vehicle.vin}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-base font-black text-slate-950">
            {vehicleTitle}
          </h2>
          <p className="mt-1 break-words text-xs font-semibold text-slate-500">
            {stockOrVin || "Stock and VIN not recorded"}
          </p>
        </div>
        <WarrantyStatusBadge status={status} />
      </div>

      {!warranty && (
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
          Sold vehicle with no warranty coverage added.
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold text-slate-400">Customer</dt>
          <dd className="mt-1 font-bold text-slate-800">
            {getCustomerName(sale)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">Start Date</dt>
          <dd className="mt-1 font-bold text-slate-800">
            {formatWarrantyDate(getWarrantyStartDate(warranty))}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">Period</dt>
          <dd className="mt-1 font-bold text-slate-800">
            {warrantyMonths
              ? `${warrantyMonths} ${
                  warrantyMonths === 1 ? "month" : "months"
                }`
              : "Not available"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">End Date</dt>
          <dd className="mt-1 font-bold text-slate-800">
            {formatWarrantyDate(endDate)}
          </dd>
        </div>
      </dl>

      {canManage && sale?.id && (
        <button
          className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100 sm:w-auto"
          onClick={() => onEdit(record)}
          type="button"
        >
          {warranty ? "Edit / Extend Warranty" : "Add Warranty"}
        </button>
      )}
    </article>
  );
}

function WarrantiesPage({ currentProfile }) {
  const [records, setRecords] = useState([]);
  const [statusFilter, setStatusFilter] = useState(getInitialStatusFilter);
  const [editorRecord, setEditorRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const canManage = hasPermission(currentProfile?.role, "warranty:manage");

  const loadWarranties = useCallback(async () => {
    if (!canManage) {
      setRecords([]);
      setIsLoading(false);
      return false;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await fetchWarrantyRegisterData();

      if (error) {
        console.error("Could not load warranties:", error);
        setRecords([]);
        setErrorMessage("Could not load warranty records. Please try again.");
        return false;
      }

      setRecords((data ?? []).filter(isSoldVehicleRecord));
      return true;
    } catch (error) {
      console.error("Could not load warranties:", error);
      setRecords([]);
      setErrorMessage("Could not load warranty records. Please try again.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialWarranties() {
      if (!canManage) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data, error } = await fetchWarrantyRegisterData();

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("Could not load warranties:", error);
          setRecords([]);
          setErrorMessage("Could not load warranty records. Please try again.");
          return;
        }

        setRecords((data ?? []).filter(isSoldVehicleRecord));
      } catch (error) {
        if (isMounted) {
          console.error("Could not load warranties:", error);
          setRecords([]);
          setErrorMessage("Could not load warranty records. Please try again.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialWarranties();

    return () => {
      isMounted = false;
    };
  }, [canManage]);

  const filterCounts = useMemo(
    () =>
      records.reduce(
        (counts, record) => ({
          ...counts,
          [record.status.key]: (counts[record.status.key] ?? 0) + 1,
        }),
        { active: 0, expired: 0, expiring: 0, none: 0 }
      ),
    [records]
  );
  const visibleRecords =
    statusFilter === "all"
      ? records
      : records.filter((record) => record.status.key === statusFilter);

  function handleStatusFilterChange(nextFilter) {
    setStatusFilter(nextFilter);

    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);

    if (nextFilter === "all") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", nextFilter);
    }

    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  async function handleWarrantySaved(savedWarranty) {
    const didReload = await loadWarranties();

    if (!didReload) {
      return;
    }

    handleStatusFilterChange(
      getWarrantyStatus(getWarrantyEndDate(savedWarranty)).key
    );
  }

  if (!canManage) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
        Warranty details are limited to authorized sales roles.
      </section>
    );
  }

  return (
    <div className="space-y-4 text-slate-950">
      <header className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              Sold Vehicle Coverage
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">
              Warranty Register
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Track sold vehicles, warranty coverage, expiry dates, and
              no-warranty sales.
            </p>
          </div>
          <button
            className={buttonClassNames.secondary}
            disabled={isLoading}
            onClick={loadWarranties}
            type="button"
          >
            <AppIcon name="refresh" size={18} />
            Refresh
          </button>
        </div>
      </header>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-2">
          {statusFilters.map((filter) => {
            const count =
              filter.key === "all"
                ? records.length
                : filterCounts[filter.key] ?? 0;
            const isActive = statusFilter === filter.key;

            return (
              <button
                className={`min-h-10 rounded-xl px-3 py-2 text-sm font-bold transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
                key={filter.key}
                onClick={() => handleStatusFilterChange(filter.key)}
                type="button"
              >
                {filter.label} <span className="tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {errorMessage && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {errorMessage}
        </section>
      )}

      {isLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Loading warranties...
          </p>
        </section>
      ) : !errorMessage && visibleRecords.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <AppIcon className="mx-auto text-slate-300" name="checklist" size={30} />
          <h2 className="mt-3 font-black text-slate-800">
            No warranty records found
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {statusFilter === "all"
              ? "Sold vehicles and their warranties will appear here."
              : `There are no ${displayValue(
                  statusFilters
                    .find((filter) => filter.key === statusFilter)
                    ?.label.toLowerCase(),
                  "matching"
                )} warranties.`}
          </p>
        </section>
      ) : (
        <section className="grid gap-3 xl:grid-cols-2">
          {visibleRecords.map((record) => (
            <WarrantyCard
              canManage={canManage}
              key={record.vehicleId}
              onEdit={setEditorRecord}
              record={record}
            />
          ))}
        </section>
      )}

      {editorRecord?.sale?.id && (
        <WarrantyEditorForm
          defaultStartDate={
            editorRecord.sale.sale_date ?? editorRecord.sale.created_at
          }
          onClose={() => setEditorRecord(null)}
          onSaved={handleWarrantySaved}
          saleId={editorRecord.sale.id}
          warranty={editorRecord.warranty}
        />
      )}
    </div>
  );
}

export default WarrantiesPage;
