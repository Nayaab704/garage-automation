import { useEffect, useMemo, useState } from "react";
import AddVendorForm from "../components/vendors/AddVendorForm";
import EditVendorForm from "../components/vendors/EditVendorForm";
import AppIcon from "../components/ui/AppIcon";
import ModalShell from "../components/ui/ModalShell";
import OperationalSearchBar from "../components/ui/OperationalSearchBar";
import { buttonClassNames, formControlClassNames } from "../components/ui/uiStyles";
import { supabase } from "../lib/supabaseClient";
import {
  fetchVendorsWithStats,
  withEmptyVendorStats,
} from "../lib/vendors";
import { formatUserFirstName } from "../lib/userDisplay";
import useDebouncedValue from "../hooks/useDebouncedValue";

const vendorTypeOptions = [
  { value: "all", label: "All Types" },
  { value: "parts", label: "Parts Supplier" },
  { value: "service", label: "Service / Repair Vendor" },
  { value: "auction", label: "Auction / Source" },
  { value: "other", label: "Other" },
];

const vendorTypeLabels = {
  auction: "Auction / Source",
  other: "Other",
  parts: "Parts Supplier",
  service: "Service / Repair Vendor",
};

const historyStatusLabels = {
  purchased: "Purchased",
  quoted: "Quoted",
  rejected: "Rejected",
  unavailable: "Unavailable",
};

const availabilityLabels = {
  in_stock: "In stock",
  order_needed: "Order needed",
  unavailable: "Unavailable",
  unknown: "Unknown",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US");

function numberOrZero(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatCurrency(value) {
  return currencyFormatter.format(numberOrZero(value));
}

function formatNumber(value) {
  return numberFormatter.format(numberOrZero(value));
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function getVendorTypeLabel(vendorType) {
  return vendorTypeLabels[vendorType] ?? displayValue(vendorType);
}

function getVendorTypeClassName(vendorType) {
  if (vendorType === "parts") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (vendorType === "service") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (vendorType === "auction") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function getHistoryStatusLabel(value) {
  return historyStatusLabels[value] ?? "Quoted";
}

function getHistoryStatusClassName(value) {
  if (value === "purchased") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (value === "rejected" || value === "unavailable") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  return "bg-blue-50 text-blue-700 ring-blue-200";
}

function getVehicleSnapshotLabel(entry) {
  const vehicle = entry.vehicle;

  if (vehicle) {
    const vehicleName = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
      .filter(Boolean)
      .join(" ");

    return [vehicle.stock_number, vehicleName].filter(Boolean).join(" - ");
  }

  const snapshot = entry.vehicleSnapshot;

  if (!snapshot) {
    return "";
  }

  const vehicleName = [
    snapshot.year,
    snapshot.make,
    snapshot.model,
    snapshot.trim,
  ]
    .filter(Boolean)
    .join(" ");

  return [snapshot.stockNumber, vehicleName].filter(Boolean).join(" - ");
}

function getWorkOrderLabel(entry) {
  const serviceCategory = entry.serviceCategory?.name || entry.repairJob?.category;
  return [serviceCategory, entry.repairJob?.title].filter(Boolean).join(" - ");
}

function normalizeSearch(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getVendorHistorySearchValues(entry) {
  const vehicle = entry.vehicle;
  const snapshot = entry.vehicleSnapshot;

  return [
    entry.partName,
    entry.quoteStatus,
    getHistoryStatusLabel(entry.quoteStatus),
    entry.availability,
    availabilityLabels[entry.availability],
    entry.notes,
    entry.source,
    getVehicleSnapshotLabel(entry),
    getWorkOrderLabel(entry),
    vehicle?.stock_number,
    vehicle?.vin,
    vehicle?.year,
    vehicle?.make,
    vehicle?.model,
    vehicle?.trim,
    vehicle?.color,
    vehicle?.status,
    snapshot?.stockNumber,
    snapshot?.year,
    snapshot?.make,
    snapshot?.model,
    snapshot?.trim,
    entry.createdByProfile?.full_name,
    entry.createdByProfile?.email,
  ];
}

function vendorMatchesSearch(vendor, searchTerm) {
  const normalizedSearch = normalizeSearch(searchTerm);

  if (!normalizedSearch) {
    return true;
  }

  return normalizeSearch([
    vendor.name,
    vendor.phone,
    vendor.email,
    vendor.address,
    vendor.notes,
    vendor.vendor_type,
    getVendorTypeLabel(vendor.vendor_type),
    ...(vendor.history ?? []).flatMap(getVendorHistorySearchValues),
  ].filter(Boolean).join(" ")).includes(normalizedSearch);
}

function historyMatchesSearch(entry, searchTerm) {
  const normalizedSearch = normalizeSearch(searchTerm);

  if (!normalizedSearch) {
    return true;
  }

  return normalizeSearch(
    getVendorHistorySearchValues(entry).filter(Boolean).join(" ")
  ).includes(normalizedSearch);
}

function getDeleteErrorMessage(error) {
  const message = String(error?.message ?? "").toLowerCase();

  if (
    error?.code === "23503" ||
    message.includes("foreign key") ||
    message.includes("violates")
  ) {
    return "This vendor is already used in records. Consider editing it instead of deleting.";
  }

  return "Could not delete vendor. Please try again.";
}

function VendorStatsCard({ label, value }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </article>
  );
}

function VendorEmptyState({ hasSearch, onClearSearch }) {
  return (
    <section className="rounded-3xl border border-dashed border-slate-300 bg-white/90 p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <AppIcon name="users" size={24} />
      </div>
      <h3 className="mt-4 text-lg font-black text-slate-950">
        {hasSearch ? "No matching records found." : "No vendors added yet."}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {hasSearch
          ? "Try searching by VIN, stock number, vehicle, part, or vendor."
          : "Add vendors so part quotes and purchase orders can be tracked."}
      </p>
      {hasSearch && onClearSearch && (
        <button
          className={`mt-4 ${buttonClassNames.secondary}`}
          onClick={onClearSearch}
          type="button"
        >
          Clear Search
        </button>
      )}
    </section>
  );
}

function VendorCard({
  canManageVendors,
  deletingVendorId,
  onDelete,
  onEdit,
  onViewHistory,
  vendor,
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black text-slate-950">
            {displayValue(vendor.name)}
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {vendor.stats.quoteCount} quotes - {vendor.stats.purchasedCount} purchased - Last used{" "}
            {formatDate(vendor.stats.lastUsedAt)}
          </p>
        </div>

        <span
          className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-black ring-1 ring-inset ${getVendorTypeClassName(
            vendor.vendor_type
          )}`}
        >
          {getVendorTypeLabel(vendor.vendor_type)}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
        <p className="text-sm font-black text-slate-950">
          Total spend: {formatCurrency(vendor.stats.totalSpend)}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          {vendor.history.length > 0
            ? "Quotes and purchases are available in price history."
            : "No price history yet."}
        </p>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Phone
          </p>
          <p className="mt-1 font-semibold text-slate-700">
            {displayValue(vendor.phone)}
          </p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Email
          </p>
          <p className="mt-1 font-semibold text-slate-700">
            {displayValue(vendor.email)}
          </p>
        </div>
      </div>

      {vendor.notes && (
        <p className="mt-4 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-500">
          {vendor.notes}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className={buttonClassNames.primary}
          onClick={() => onViewHistory(vendor.id)}
          type="button"
        >
          View History
        </button>

        {canManageVendors && (
          <>
            <button
              className={buttonClassNames.secondary}
              onClick={() => onEdit(vendor)}
              type="button"
            >
              Edit
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-black text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={deletingVendorId === vendor.id}
              onClick={() => onDelete(vendor)}
              type="button"
            >
              {deletingVendorId === vendor.id ? "Deleting..." : "Delete"}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function VendorHistoryItem({ entry }) {
  const vehicleLabel = getVehicleSnapshotLabel(entry);
  const workOrderLabel = getWorkOrderLabel(entry);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-black text-slate-950">
            {entry.partName}
          </h4>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {formatDate(entry.date)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ring-1 ring-inset ${getHistoryStatusClassName(
            entry.quoteStatus
          )}`}
        >
          {getHistoryStatusLabel(entry.quoteStatus)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
        <span className="font-black text-slate-950">
          {formatCurrency(entry.unitPrice)} each
        </span>
        <span>Qty {formatNumber(entry.quantity || 1)}</span>
        <span>Total {formatCurrency(entry.totalPrice)}</span>
        {entry.availability && (
          <span>{availabilityLabels[entry.availability] ?? entry.availability}</span>
        )}
      </div>

      {entry.source === "quote" && entry.createdByProfile && (
        <p className="mt-2 text-xs font-semibold text-slate-400">
          Quote added by {formatUserFirstName(entry.createdByProfile)} -{" "}
          {formatDate(entry.date)}
        </p>
      )}

      {(vehicleLabel || workOrderLabel) && (
        <div className="mt-3 space-y-1 text-xs font-semibold text-slate-500">
          {vehicleLabel && <p>{vehicleLabel}</p>}
          {workOrderLabel && <p>{workOrderLabel}</p>}
        </div>
      )}

      {entry.notes && (
        <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          {entry.notes}
        </p>
      )}
    </article>
  );
}

function VendorHistoryModal({ onClose, vendor }) {
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const debouncedHistorySearchTerm = useDebouncedValue(historySearchTerm, 300);
  const filteredHistory = useMemo(
    () =>
      vendor.history.filter((entry) =>
        historyMatchesSearch(entry, debouncedHistorySearchTerm)
      ),
    [debouncedHistorySearchTerm, vendor.history]
  );

  return (
    <ModalShell
      description="Previous quotes and purchases connected to this vendor."
      onClose={onClose}
      size="xl"
      title={`${vendor.name || "Vendor"} History`}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <VendorStatsCard
            label="Quotes"
            value={formatNumber(vendor.stats.quoteCount)}
          />
          <VendorStatsCard
            label="Purchased"
            value={formatNumber(vendor.stats.purchasedCount)}
          />
          <VendorStatsCard
            label="Spend"
            value={formatCurrency(vendor.stats.totalSpend)}
          />
        </div>

        <label className="relative block" htmlFor="vendor-history-search">
          <span className="sr-only">Search vendor history</span>
          <AppIcon
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            name="search"
            size={18}
          />
          <input
            className={formControlClassNames.input.replace("px-4", "pl-11 pr-4")}
            id="vendor-history-search"
            onChange={(event) => setHistorySearchTerm(event.target.value)}
            placeholder="Search part, stock, vehicle, or status"
            type="search"
            value={historySearchTerm}
          />
        </label>

        {filteredHistory.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="font-black text-slate-950">
              {debouncedHistorySearchTerm.trim()
                ? "No matching history found."
                : "No price history yet."}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {debouncedHistorySearchTerm.trim()
                ? "Try a different part name, vehicle, or status."
                : "Quotes and purchases for this vendor will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((entry) => (
              <VendorHistoryItem entry={entry} key={entry.id} />
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function VendorsPage({ currentProfile }) {
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  const [deletingVendorId, setDeletingVendorId] = useState(null);
  const [editingVendor, setEditingVendor] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [selectedVendorType, setSelectedVendorType] = useState("all");
  const [vendors, setVendors] = useState([]);

  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  const canManageVendors =
    currentProfile?.role === "admin" || currentProfile?.role === "owner";

  const summary = useMemo(
    () =>
      vendors.reduce(
        (totals, vendor) => ({
          purchasedParts: totals.purchasedParts + vendor.stats.purchasedCount,
          quotesSaved: totals.quotesSaved + vendor.stats.quoteCount,
          totalSpend: totals.totalSpend + vendor.stats.totalSpend,
          totalVendors: totals.totalVendors + 1,
        }),
        {
          purchasedParts: 0,
          quotesSaved: 0,
          totalSpend: 0,
          totalVendors: 0,
        }
      ),
    [vendors]
  );

  const filteredVendors = useMemo(() => {
    return vendors.filter((vendor) => {
      const matchesType =
        selectedVendorType === "all" ||
        vendor.vendor_type === selectedVendorType;

      return matchesType && vendorMatchesSearch(vendor, debouncedSearchTerm);
    });
  }, [debouncedSearchTerm, selectedVendorType, vendors]);

  const vendorTypeResultCount = useMemo(() => {
    if (selectedVendorType === "all") {
      return vendors.length;
    }

    return vendors.filter((vendor) => vendor.vendor_type === selectedVendorType)
      .length;
  }, [selectedVendorType, vendors]);

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.id === selectedVendorId) ?? null,
    [selectedVendorId, vendors]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadVendors() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data, error } = await fetchVendorsWithStats();

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("Could not load vendors:", error);
          setErrorMessage("Could not load vendors. Please try again.");
          return;
        }

        setVendors(data.vendors ?? []);
      } catch (error) {
        if (isMounted) {
          console.error("Could not load vendors:", error);
          setErrorMessage("Could not load vendors. Please try again.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadVendors();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleVendorAdded(vendor) {
    if (!vendor?.id) {
      return;
    }

    setVendors((currentVendors) => [
      withEmptyVendorStats(vendor),
      ...currentVendors,
    ]);
  }

  function handleVendorUpdated(vendor) {
    if (!vendor?.id) {
      return;
    }

    setVendors((currentVendors) =>
      currentVendors.map((currentVendor) =>
        currentVendor.id === vendor.id ? { ...currentVendor, ...vendor } : currentVendor
      )
    );
  }

  async function handleDeleteVendor(vendor) {
    if (!canManageVendors) {
      setDeleteErrorMessage("Your role cannot delete vendors.");
      return;
    }

    if (!window.confirm("Delete this vendor? This cannot be undone.")) {
      return;
    }

    setDeleteErrorMessage("");
    setDeletingVendorId(vendor.id);

    try {
      const { error } = await supabase
        .from("vendors")
        .delete()
        .eq("id", vendor.id);

      if (error) {
        console.error("Could not delete vendor:", error);
        setDeleteErrorMessage(getDeleteErrorMessage(error));
        return;
      }

      setVendors((currentVendors) =>
        currentVendors.filter((currentVendor) => currentVendor.id !== vendor.id)
      );
      setSelectedVendorId((currentVendorId) =>
        currentVendorId === vendor.id ? null : currentVendorId
      );
    } catch (error) {
      console.error("Could not delete vendor:", error);
      setDeleteErrorMessage("Could not delete vendor. Please try again.");
    } finally {
      setDeletingVendorId(null);
    }
  }

  function clearFilters() {
    setSearchTerm("");
    setSelectedVendorType("all");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Vendors</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Track vendors, previous part prices, and purchase history.
            </p>
          </div>

          {canManageVendors && (
            <button
              className={buttonClassNames.primary}
              onClick={() => setIsAddFormOpen(true)}
              type="button"
            >
              <AppIcon name="plus" size={16} />
              Add Vendor
            </button>
          )}
        </div>

        <div className="mt-4">
          <OperationalSearchBar
            activeFilterCount={selectedVendorType === "all" ? 0 : 1}
            id="vendor-search"
            label="Search vendors"
            onChange={setSearchTerm}
            onClear={clearFilters}
            placeholder="Search vendor, part, vehicle, VIN..."
            resultCount={filteredVendors.length}
            totalCount={vendorTypeResultCount}
            value={searchTerm}
          >
            <label className="block w-full sm:w-56" htmlFor="vendor-type-filter">
              <span className={formControlClassNames.label}>Type</span>
              <select
                className={formControlClassNames.select}
                id="vendor-type-filter"
                onChange={(event) => setSelectedVendorType(event.target.value)}
                value={selectedVendorType}
              >
                {vendorTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </OperationalSearchBar>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <VendorStatsCard
          label="Total Vendors"
          value={formatNumber(summary.totalVendors)}
        />
        <VendorStatsCard
          label="Quotes Saved"
          value={formatNumber(summary.quotesSaved)}
        />
        <VendorStatsCard
          label="Purchased Parts"
          value={formatNumber(summary.purchasedParts)}
        />
        <VendorStatsCard
          label="Total Spend"
          value={formatCurrency(summary.totalSpend)}
        />
      </section>

      {deleteErrorMessage && (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {deleteErrorMessage}
        </section>
      )}

      {isLoading && (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-slate-700">Loading vendors...</p>
        </section>
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {errorMessage}
        </section>
      )}

      {!isLoading && !errorMessage && filteredVendors.length === 0 && (
        <VendorEmptyState
          hasSearch={
            Boolean(debouncedSearchTerm.trim()) || selectedVendorType !== "all"
          }
          onClearSearch={clearFilters}
        />
      )}

      {!isLoading && !errorMessage && filteredVendors.length > 0 && (
        <section className="grid gap-4 xl:grid-cols-2">
          {filteredVendors.map((vendor) => (
            <VendorCard
              canManageVendors={canManageVendors}
              deletingVendorId={deletingVendorId}
              key={vendor.id}
              onDelete={handleDeleteVendor}
              onEdit={setEditingVendor}
              onViewHistory={setSelectedVendorId}
              vendor={vendor}
            />
          ))}
        </section>
      )}

      {isAddFormOpen && canManageVendors && (
        <AddVendorForm
          onClose={() => setIsAddFormOpen(false)}
          onVendorAdded={handleVendorAdded}
        />
      )}

      {editingVendor && canManageVendors && (
        <EditVendorForm
          onClose={() => setEditingVendor(null)}
          onVendorUpdated={handleVendorUpdated}
          vendor={editingVendor}
        />
      )}

      {selectedVendor && (
        <VendorHistoryModal
          onClose={() => setSelectedVendorId(null)}
          vendor={selectedVendor}
        />
      )}
    </div>
  );
}

export default VendorsPage;
