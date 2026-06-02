import { useEffect, useMemo, useState } from "react";
import AddVendorForm from "../components/vendors/AddVendorForm";
import EditVendorForm from "../components/vendors/EditVendorForm";
import { supabase } from "../lib/supabaseClient";

const vendorColumns =
  "id, name, phone, email, address, vendor_type, notes, created_at";

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

function vendorMatchesSearch(vendor, searchTerm) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [vendor.name, vendor.phone, vendor.email].some((value) =>
    String(value ?? "")
      .toLowerCase()
      .includes(normalizedSearch)
  );
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

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
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

  return error?.message ?? "Unable to delete vendor.";
}

async function fetchVendors() {
  return supabase
    .from("vendors")
    .select(vendorColumns)
    .order("created_at", { ascending: false });
}

function VendorsPage({ currentProfile }) {
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  const [editingVendor, setEditingVendor] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendorType, setSelectedVendorType] = useState("all");
  const [vendors, setVendors] = useState([]);
  const [deletingVendorId, setDeletingVendorId] = useState(null);

  const canManageVendors =
    currentProfile?.role === "admin" || currentProfile?.role === "owner";

  const filteredVendors = useMemo(() => {
    return vendors.filter((vendor) => {
      const matchesType =
        selectedVendorType === "all" ||
        vendor.vendor_type === selectedVendorType;

      return matchesType && vendorMatchesSearch(vendor, searchTerm);
    });
  }, [searchTerm, selectedVendorType, vendors]);

  useEffect(() => {
    let isMounted = true;

    async function loadVendors() {
      try {
        const { data, error } = await fetchVendors();

        if (!isMounted) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        setVendors(data ?? []);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message ?? "Unable to load vendors.");
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

    setVendors((currentVendors) => [vendor, ...currentVendors]);
  }

  function handleVendorUpdated(vendor) {
    if (!vendor?.id) {
      return;
    }

    setVendors((currentVendors) =>
      currentVendors.map((currentVendor) =>
        currentVendor.id === vendor.id ? vendor : currentVendor
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
        setDeleteErrorMessage(getDeleteErrorMessage(error));
        return;
      }

      setVendors((currentVendors) =>
        currentVendors.filter((currentVendor) => currentVendor.id !== vendor.id)
      );
    } catch (error) {
      setDeleteErrorMessage(error.message ?? "Unable to delete vendor.");
    } finally {
      setDeletingVendorId(null);
    }
  }

  function clearFilters() {
    setSearchTerm("");
    setSelectedVendorType("all");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Vendor Management
            </p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">Vendors</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Manage the suppliers, service shops, auction sources, and other
              partners used across garage operations.
            </p>
          </div>

          {canManageVendors && (
            <button
              className="w-fit rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
              onClick={() => setIsAddFormOpen(true)}
              type="button"
            >
              Add Vendor
            </button>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto] lg:items-end">
          <label className="block" htmlFor="vendor-search">
            <span className="text-sm font-medium text-zinc-700">Search</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="vendor-search"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, phone, or email"
              type="search"
              value={searchTerm}
            />
          </label>

          <label className="block" htmlFor="vendor-type-filter">
            <span className="text-sm font-medium text-zinc-700">Type</span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
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

          <button
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            onClick={clearFilters}
            type="button"
          >
            Clear Filters
          </button>
        </div>

        <p className="mt-4 text-sm text-zinc-500">
          Showing {filteredVendors.length} of {vendors.length} vendors
        </p>
      </section>

      {deleteErrorMessage && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {deleteErrorMessage}
        </section>
      )}

      {isLoading && (
        <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-zinc-700">Loading vendors...</p>
        </section>
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMessage}
        </section>
      )}

      {!isLoading && !errorMessage && filteredVendors.length === 0 && (
        <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm">
          <h3 className="text-lg font-bold text-zinc-950">No vendors found</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Add a vendor or adjust your filters to see more records.
          </p>
        </section>
      )}

      {!isLoading && !errorMessage && filteredVendors.length > 0 && (
        <section className="grid gap-4 xl:grid-cols-2">
          {filteredVendors.map((vendor) => (
            <article
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
              key={vendor.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-zinc-950">
                    {displayValue(vendor.name)}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Added {formatDate(vendor.created_at)}
                  </p>
                </div>

                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getVendorTypeClassName(
                    vendor.vendor_type
                  )}`}
                >
                  {getVendorTypeLabel(vendor.vendor_type)}
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-zinc-500">Phone</p>
                  <p className="mt-1 font-medium text-zinc-800">
                    {displayValue(vendor.phone)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Email</p>
                  <p className="mt-1 font-medium text-zinc-800">
                    {displayValue(vendor.email)}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="text-zinc-500">Address</p>
                  <p className="mt-1 whitespace-pre-wrap font-medium text-zinc-800">
                    {displayValue(vendor.address)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap leading-6 text-zinc-700">
                    {displayValue(vendor.notes)}
                  </p>
                </div>
              </div>

              {canManageVendors && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                    onClick={() => setEditingVendor(vendor)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={deletingVendorId === vendor.id}
                    onClick={() => handleDeleteVendor(vendor)}
                    type="button"
                  >
                    {deletingVendorId === vendor.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              )}
            </article>
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
    </div>
  );
}

export default VendorsPage;
