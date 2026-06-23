import { useEffect, useMemo, useState } from "react";
import AppIcon from "../components/ui/AppIcon";
import VehicleCard from "../components/VehicleCard";
import { supabase } from "../lib/supabaseClient";
import { formatVehicleStatus, vehicleStatusOptions } from "../lib/vehicleStatus";

const vehicleColumns =
  "id, stock_number, vin, year, make, model, trim, mileage, color, title_status, status";

const vehiclePhotoColumns =
  "id, vehicle_id, photo_url, repair_job_id, created_at";

const titleStatusOptions = [
  { value: "clean", label: "Clean Title" },
  { value: "salvage", label: "Salvage" },
  { value: "rebuilt", label: "Rebuilt" },
  { value: "flood", label: "Flood" },
  { value: "unknown", label: "Unknown" },
];

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

function buildVehiclePhotoMap(photos) {
  return photos.reduce((photoMap, photo) => {
    if (!photo.vehicle_id || !photo.photo_url) {
      return photoMap;
    }

    const currentPhoto = photoMap[photo.vehicle_id];
    const isVehicleLevelPhoto = !photo.repair_job_id;
    const currentIsWorkOrderPhoto = currentPhoto?.repair_job_id;

    if (!currentPhoto || (isVehicleLevelPhoto && currentIsWorkOrderPhoto)) {
      photoMap[photo.vehicle_id] = photo;
    }

    return photoMap;
  }, {});
}

function getActiveFilterCount(searchText, statusFilter, titleStatusFilter) {
  let count = 0;

  if (searchText.trim()) {
    count += 1;
  }

  if (statusFilter !== "all") {
    count += 1;
  }

  if (titleStatusFilter !== "all") {
    count += 1;
  }

  return count;
}

function getVehicleSummary(vehicles) {
  const activeVehicles = vehicles.filter(
    (vehicle) => !["archived", "sold"].includes(vehicle.status)
  );

  return {
    active: activeVehicles.length,
    total: vehicles.length,
  };
}

async function fetchVehiclesWithPhotos() {
  const vehiclesResponse = await supabase
    .from("vehicles")
    .select(vehicleColumns)
    .order("stock_number", { ascending: true });

  if (vehiclesResponse.error) {
    return { data: null, error: vehiclesResponse.error };
  }

  const vehicles = vehiclesResponse.data ?? [];
  const vehicleIds = vehicles.map((vehicle) => vehicle.id).filter(Boolean);

  if (vehicleIds.length === 0) {
    return {
      data: {
        vehiclePhotosByVehicleId: {},
        vehicles,
      },
      error: null,
    };
  }

  const photosResponse = await supabase
    .from("vehicle_photos")
    .select(vehiclePhotoColumns)
    .in("vehicle_id", vehicleIds)
    .order("created_at", { ascending: false });

  if (photosResponse.error) {
    console.error("Could not load vehicle photos:", photosResponse.error);
  }

  return {
    data: {
      vehiclePhotosByVehicleId: photosResponse.error
        ? {}
        : buildVehiclePhotoMap(photosResponse.data ?? []),
      vehicles,
    },
    error: null,
  };
}

function FilterSelect({ children, id, label, onChange, value }) {
  return (
    <label className="block" htmlFor={id}>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <select
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
        id={id}
        onChange={onChange}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

function StatCard({ helperText, icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
        <AppIcon name={icon} size={20} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500">{label}</p>
        <p className="text-lg font-black leading-none text-slate-950">
          {value}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{helperText}</p>
      </div>
    </div>
  );
}

function VehiclesPage({ onSelectVehicle }) {
  const [vehicles, setVehicles] = useState([]);
  const [vehiclePhotosByVehicleId, setVehiclePhotosByVehicleId] = useState({});
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [titleStatusFilter, setTitleStatusFilter] = useState("all");
  const [areFiltersOpen, setAreFiltersOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function fetchVehicles() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data, error } = await fetchVehiclesWithPhotos();

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("Could not load vehicles:", error);
          setErrorMessage("Could not load vehicles.");
          setVehicles([]);
          setVehiclePhotosByVehicleId({});
          return;
        }

        setVehicles(data.vehicles);
        setVehiclePhotosByVehicleId(data.vehiclePhotosByVehicleId);
      } catch (error) {
        if (isMounted) {
          console.error("Could not load vehicles:", error);
          setErrorMessage("Could not load vehicles.");
          setVehicles([]);
          setVehiclePhotosByVehicleId({});
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
  }, []);

  async function refreshVehicles() {
    if (isLoading || isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setErrorMessage("");

    try {
      const { data, error } = await fetchVehiclesWithPhotos();

      if (error) {
        console.error("Could not load vehicles:", error);
        setErrorMessage("Could not load vehicles.");
        return;
      }

      setVehicles(data.vehicles);
      setVehiclePhotosByVehicleId(data.vehiclePhotosByVehicleId);
    } catch (error) {
      console.error("Could not load vehicles:", error);
      setErrorMessage("Could not load vehicles.");
    } finally {
      setIsRefreshing(false);
    }
  }

  function clearFilters() {
    setSearchText("");
    setStatusFilter("all");
    setTitleStatusFilter("all");
  }

  const filteredVehicles = useMemo(
    () =>
      getFilteredVehicles(
        vehicles,
        searchText,
        statusFilter,
        titleStatusFilter
      ),
    [searchText, statusFilter, titleStatusFilter, vehicles]
  );
  const activeFilterCount = getActiveFilterCount(
    searchText,
    statusFilter,
    titleStatusFilter
  );
  const vehicleSummary = getVehicleSummary(vehicles);
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="space-y-3">
      <section className="space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <label className="block min-w-0" htmlFor="vehicle-search">
            <span className="sr-only">Search vehicles</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 sm:left-4">
                <AppIcon name="search" size={19} />
              </span>
              <input
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 sm:pl-12 sm:text-base"
                id="vehicle-search"
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search stock, VIN, make, or model"
                type="search"
                value={searchText}
              />
            </div>
          </label>

          <div className="flex gap-2">
            <button
              className={`inline-flex h-12 w-12 items-center justify-center gap-1.5 rounded-2xl border px-0 text-sm font-bold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:w-auto sm:gap-2 sm:px-4 ${
                areFiltersOpen
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => setAreFiltersOpen((isOpen) => !isOpen)}
              type="button"
            >
              <AppIcon name="filter" size={19} />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] leading-none text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              aria-label="Refresh vehicles"
              className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${
                isRefreshing ? "w-auto px-4" : "w-12"
              }`}
              disabled={isLoading || isRefreshing}
              onClick={refreshVehicles}
              type="button"
            >
              <AppIcon name="refresh" size={18} />
              {isRefreshing && (
                <span className="text-sm font-bold">Refreshing...</span>
              )}
            </button>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            className="w-fit rounded-xl px-1 text-sm font-semibold text-emerald-700 transition hover:text-emerald-800"
            onClick={clearFilters}
            type="button"
          >
            Clear filters
          </button>
        )}

        {areFiltersOpen && (
          <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
            <FilterSelect
              id="vehicle-status-filter"
              label="Status"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="all">All Statuses</option>
              {vehicleStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatVehicleStatus(status)}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              id="vehicle-title-status-filter"
              label="Title Status"
              onChange={(event) => setTitleStatusFilter(event.target.value)}
              value={titleStatusFilter}
            >
              <option value="all">All Titles</option>
              {titleStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FilterSelect>
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3">
        <StatCard
          helperText="All in inventory"
          icon="car"
          label="Total Vehicles"
          value={vehicleSummary.total}
        />
        <StatCard
          helperText="Open inventory"
          icon="chart-up"
          label="Active Vehicles"
          value={vehicleSummary.active}
        />
      </section>

      {isLoading && (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-slate-700">Loading vehicles...</p>
        </section>
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm">
          <h3 className="font-semibold">Unable to load vehicles</h3>
          <p className="mt-2 text-sm">{errorMessage}</p>
        </section>
      )}

      {!isLoading && !errorMessage && vehicles.length === 0 && (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
            <AppIcon name="car" size={34} />
          </div>
          <h3 className="mt-4 text-lg font-black text-slate-950">
            No vehicles found
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Start with intake to add the first vehicle to inventory.
          </p>
        </section>
      )}

      {!isLoading &&
        !errorMessage &&
        vehicles.length > 0 &&
        filteredVehicles.length === 0 && (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-black text-slate-950">
              No vehicles found
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Try adjusting your search or filters.
            </p>
            <button
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              onClick={clearFilters}
              type="button"
            >
              Clear Filters
            </button>
          </section>
        )}

      {!isLoading && !errorMessage && filteredVehicles.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredVehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              onSelectVehicle={onSelectVehicle}
              photo={vehiclePhotosByVehicleId[vehicle.id]}
              vehicle={vehicle}
            />
          ))}
        </section>
      )}
    </div>
  );
}

export default VehiclesPage;
