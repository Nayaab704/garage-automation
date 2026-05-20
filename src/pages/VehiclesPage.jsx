import { useEffect, useState } from "react";
import AddVehicleForm from "../components/AddVehicleForm";
import VehicleOriginBadge from "../components/VehicleOriginBadge";
import VehicleStatusBadge from "../components/VehicleStatusBadge";
import { hasPermission } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";
import { formatVehicleStatus, vehicleStatusOptions } from "../lib/vehicleStatus";

const vehicleColumns =
  "id, stock_number, vin, year, make, model, trim, mileage, color, title_status, vehicle_origin, status, purchase_price, target_sale_price, notes";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US");

const titleStatusOptions = [
  { value: "clean", label: "Clean Title" },
  { value: "salvage", label: "Salvage" },
  { value: "rebuilt", label: "Rebuilt" },
  { value: "flood", label: "Flood" },
  { value: "unknown", label: "Unknown" },
];

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatCurrency(value) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "Not available";
  }

  return currencyFormatter.format(numberValue);
}

function formatNumber(value) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "Not available";
  }

  return numberFormatter.format(numberValue);
}

function formatTitleStatus(status) {
  const labels = {
    clean: "Clean Title",
    salvage: "Salvage",
    rebuilt: "Rebuilt",
    flood: "Flood",
    unknown: "Unknown",
  };

  return labels[status] ?? "Unknown";
}

function titleStatusClassName(status) {
  if (status === "clean") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "salvage" || status === "flood") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "rebuilt") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function valueMatchesSearch(value, searchText) {
  return String(value ?? "")
    .toLowerCase()
    .includes(searchText);
}

function vehicleMatchesSearch(vehicle, searchText) {
  if (!searchText) {
    return true;
  }

  return (
    valueMatchesSearch(vehicle.stock_number, searchText) ||
    valueMatchesSearch(vehicle.vin, searchText) ||
    valueMatchesSearch(vehicle.make, searchText) ||
    valueMatchesSearch(vehicle.model, searchText)
  );
}

function getFilteredVehicles(vehicles, searchText, statusFilter, titleFilter) {
  const normalizedSearchText = searchText.trim().toLowerCase();

  return vehicles.filter((vehicle) => {
    const matchesSearch = vehicleMatchesSearch(vehicle, normalizedSearchText);
    const matchesStatus =
      statusFilter === "all" || vehicle.status === statusFilter;
    const matchesTitleStatus =
      titleFilter === "all" || vehicle.title_status === titleFilter;

    return matchesSearch && matchesStatus && matchesTitleStatus;
  });
}

function VehiclesPage({ currentProfile, onSelectVehicle }) {
  const [vehicles, setVehicles] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [titleStatusFilter, setTitleStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function fetchVehicles() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data, error } = await supabase
          .from("vehicles")
          .select(vehicleColumns)
          .order("stock_number", { ascending: true });

        if (!isMounted) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          setVehicles([]);
        } else {
          setVehicles(data ?? []);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message ?? "Something went wrong.");
          setVehicles([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchVehicles();

    return () => {
      isMounted = false;
    };
  }, [refreshCount]);

  function refreshVehicles() {
    setRefreshCount((currentCount) => currentCount + 1);
  }

  function clearFilters() {
    setSearchText("");
    setStatusFilter("all");
    setTitleStatusFilter("all");
  }

  const filteredVehicles = getFilteredVehicles(
    vehicles,
    searchText,
    statusFilter,
    titleStatusFilter
  );
  const hasActiveFilters =
    searchText.trim() !== "" ||
    statusFilter !== "all" ||
    titleStatusFilter !== "all";
  const canCreateVehicle = hasPermission(
    currentProfile?.role,
    "vehicle:create"
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(320px,420px)_1fr] lg:items-start">
      {canCreateVehicle ? (
        <AddVehicleForm onVehicleAdded={refreshVehicles} />
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Add Vehicle</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your role can view inventory, but does not have permission to add
            vehicles.
          </p>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Vehicle List</h2>
            <p className="mt-1 text-sm text-slate-600">
              Showing {filteredVehicles.length} of {vehicles.length} vehicle
              {vehicles.length === 1 ? "" : "s"}
            </p>
          </div>

          <button
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={refreshVehicles}
            type="button"
          >
            Refresh
          </button>
        </div>

        {!isLoading && !errorMessage && vehicles.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_220px_220px_auto] lg:items-end">
              <label className="block" htmlFor="vehicle-search">
                <span className="text-sm font-medium text-slate-700">
                  Search
                </span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  id="vehicle-search"
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Stock, VIN, make, or model"
                  type="search"
                  value={searchText}
                />
              </label>

              <label className="block" htmlFor="vehicle-status-filter">
                <span className="text-sm font-medium text-slate-700">
                  Status
                </span>
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  id="vehicle-status-filter"
                  onChange={(event) => setStatusFilter(event.target.value)}
                  value={statusFilter}
                >
                  <option value="all">All Statuses</option>
                  {vehicleStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatVehicleStatus(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block" htmlFor="vehicle-title-status-filter">
                <span className="text-sm font-medium text-slate-700">
                  Title Status
                </span>
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  id="vehicle-title-status-filter"
                  onChange={(event) => setTitleStatusFilter(event.target.value)}
                  value={titleStatusFilter}
                >
                  <option value="all">All Titles</option>
                  {titleStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!hasActiveFilters}
                onClick={clearFilters}
                type="button"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="font-medium text-slate-700">Loading vehicles...</p>
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
            <h3 className="font-semibold">Unable to load vehicles</h3>
            <p className="mt-2 text-sm">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && vehicles.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              No vehicles found
            </h3>
            <p className="mt-2 text-slate-600">
              Use the form to add your first vehicle.
            </p>
          </div>
        )}

        {!isLoading &&
          !errorMessage &&
          vehicles.length > 0 &&
          filteredVehicles.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                No matching vehicles
              </h3>
              <p className="mt-2 text-slate-600">
                Clear filters or try a different search.
              </p>
            </div>
          )}

        {!isLoading && !errorMessage && filteredVehicles.length > 0 && (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredVehicles.map((vehicle, index) => (
              <article
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                key={`${vehicle.stock_number}-${vehicle.vin ?? index}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      Stock Number
                    </p>
                    <h3 className="mt-1 text-2xl font-bold text-slate-900">
                      {displayValue(vehicle.stock_number)}
                    </h3>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <VehicleStatusBadge status={vehicle.status} />
                    <VehicleOriginBadge origin={vehicle.vehicle_origin} />
                    {vehicle.color && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                        {vehicle.color}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${titleStatusClassName(
                        vehicle.title_status
                      )}`}
                    >
                      {formatTitleStatus(vehicle.title_status)}
                    </span>
                  </div>
                </div>

                <p className="mt-4 text-lg font-semibold text-slate-800">
                  {displayValue(vehicle.year)} {displayValue(vehicle.make)}{" "}
                  {displayValue(vehicle.model)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Trim: {displayValue(vehicle.trim)}
                </p>

                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-slate-500">VIN</dt>
                    <dd className="mt-1 break-words font-semibold text-slate-900">
                      {displayValue(vehicle.vin)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm text-slate-500">Mileage</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {formatNumber(vehicle.mileage)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm text-slate-500">Purchase Price</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {formatCurrency(vehicle.purchase_price)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm text-slate-500">
                      Target Sale Price
                    </dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {formatCurrency(vehicle.target_sale_price)}
                    </dd>
                  </div>
                </dl>

                {vehicle.notes && (
                  <div className="mt-5 rounded-md bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-500">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {vehicle.notes}
                    </p>
                  </div>
                )}

                <button
                  className="mt-5 w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!vehicle.id}
                  onClick={() => onSelectVehicle(vehicle.id)}
                  type="button"
                >
                  View Details
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default VehiclesPage;
