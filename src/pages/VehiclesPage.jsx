import { useEffect, useRef, useState } from "react";
import AppIcon from "../components/ui/AppIcon";
import VehicleCard from "../components/VehicleCard";
import VehiclePrebookingModal from "../components/vehicle-detail/VehiclePrebookingModal";
import { hasPermission } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";
import { buildVehiclePrimaryPhotoMap } from "../lib/vehicleDisplayPhoto";
import useActiveTabScroll from "../hooks/useActiveTabScroll";
import useDismissableLayer from "../hooks/useDismissableLayer";
import { activePrebookingBadgeColumns } from "../lib/vehiclePrebookings";
import {
  activeVehicleWorkflowStatuses,
  normalizeVehicleStatus,
} from "../lib/vehicleStatus";

const vehicleColumns =
  "id, stock_number, vin, year, make, model, trim, mileage, color, color_hex, title_status, status, primary_photo_id, created_at";

const vehiclePhotoColumns =
  "id, vehicle_id, photo_url, repair_job_id, created_at";

const thirdPartyRepairVehicleColumns = "vehicle_id";

const titleStatusOptions = [
  { value: "clean", label: "Clean Title" },
  { value: "salvage", label: "Salvage" },
  { value: "rebuilt", label: "Rebuilt" },
  { value: "flood", label: "Flood" },
  { value: "unknown", label: "Unknown" },
];

const VEHICLES_PAGE_SIZE = 30;

const inventoryFilterChips = [
  { icon: "car", key: "active", label: "Active", type: "tab" },
  {
    icon: "chart-up",
    key: "ready_for_sale",
    label: "Ready for Sale",
    type: "tab",
  },
  { icon: "scan", key: "inspection", label: "Inspection", type: "status" },
  { icon: "wrench", key: "repair", label: "Repair", type: "status" },
  {
    icon: "checklist",
    key: "quality_check",
    label: "Quality Check",
    type: "status",
  },
];

const workflowStatusQueryValues = {
  inspection: ["inspection", "Inspection", "not_started", "Not Started", "needed", ""],
  quality_check: ["quality_check", "Quality Check", "quality check"],
  ready_for_sale: [
    "ready_for_sale",
    "Ready For Sale",
    "Ready for Sale",
    "ready for sale",
    "ready",
    "Ready",
    "sold",
    "Sold",
    "archived",
    "Archived",
  ],
  repair: [
    "repair",
    "Repair",
    "repairing",
    "Repairing",
    "in_repair",
    "In Repair",
    "in_progress",
    "In Progress",
    "parts_needed",
    "Parts Needed",
    "waiting_for_parts",
    "Waiting For Parts",
    "waiting_parts",
    "Waiting Parts",
  ],
};

const activeStatusQueryValues = activeVehicleWorkflowStatuses.flatMap(
  (status) => workflowStatusQueryValues[status] ?? [status]
);

function getActiveFilterCount(
  searchText,
  titleStatusFilter,
  hasThirdPartyFilter,
  hasPrebookingFilter
) {
  let count = 0;

  if (searchText.trim()) {
    count += 1;
  }

  if (titleStatusFilter !== "all") {
    count += 1;
  }

  if (hasThirdPartyFilter) {
    count += 1;
  }

  if (hasPrebookingFilter) {
    count += 1;
  }

  return count;
}

function getWorkflowStatusesForQuery(activeTab, activeStatusFilter) {
  if (activeTab === "ready_for_sale") {
    return workflowStatusQueryValues.ready_for_sale;
  }

  if (activeStatusFilter !== "all_active") {
    return workflowStatusQueryValues[activeStatusFilter] ?? activeStatusQueryValues;
  }

  return activeStatusQueryValues;
}

function getSearchPattern(searchText) {
  const normalizedSearchText = searchText
    .trim()
    .replace(/[%,]/g, " ")
    .replace(/\s+/g, " ");

  return normalizedSearchText ? `%${normalizedSearchText}%` : "";
}

function applyVehicleQueryFilters(query, {
  activeStatusFilter,
  activeTab,
  prebookedVehicleIds = null,
  prebookingSearchVehicleIds = null,
  searchText,
  thirdPartyVehicleIds = null,
  titleStatusFilter,
}) {
  const workflowStatuses = getWorkflowStatusesForQuery(
    activeTab,
    activeStatusFilter
  );
  const searchPattern = getSearchPattern(searchText);
  let filteredQuery = query.in("status", workflowStatuses);

  if (titleStatusFilter !== "all") {
    filteredQuery = filteredQuery.eq("title_status", titleStatusFilter);
  }

  if (Array.isArray(thirdPartyVehicleIds)) {
    filteredQuery = filteredQuery.in("id", thirdPartyVehicleIds);
  }

  if (Array.isArray(prebookedVehicleIds)) {
    filteredQuery = filteredQuery.in("id", prebookedVehicleIds);
  }

  if (searchPattern) {
    const searchConditions = [
      `stock_number.ilike.${searchPattern}`,
      `vin.ilike.${searchPattern}`,
      `make.ilike.${searchPattern}`,
      `model.ilike.${searchPattern}`,
      `trim.ilike.${searchPattern}`,
      `color.ilike.${searchPattern}`,
    ];

    if (
      Array.isArray(prebookingSearchVehicleIds) &&
      prebookingSearchVehicleIds.length > 0
    ) {
      searchConditions.push(
        `id.in.(${prebookingSearchVehicleIds.join(",")})`
      );
    }

    filteredQuery = filteredQuery.or(
      searchConditions.join(",")
    );
  }

  return filteredQuery;
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

async function fetchThirdPartyRepairVehicleIds() {
  const response = await supabase
    .from("third_party_repairs")
    .select(thirdPartyRepairVehicleColumns);

  if (response.error) {
    return { data: [], error: response.error };
  }

  return {
    data: uniqueValues((response.data ?? []).map((record) => record.vehicle_id)),
    error: null,
  };
}

async function fetchThirdPartyRepairVehicleMap(vehicleIds) {
  if (vehicleIds.length === 0) {
    return { data: {}, error: null };
  }

  const response = await supabase
    .from("third_party_repairs")
    .select(thirdPartyRepairVehicleColumns)
    .in("vehicle_id", vehicleIds);

  if (response.error) {
    return { data: {}, error: response.error };
  }

  return {
    data: Object.fromEntries(
      uniqueValues((response.data ?? []).map((record) => record.vehicle_id)).map(
        (vehicleId) => [vehicleId, true]
      )
    ),
    error: null,
  };
}

async function fetchActivePrebookingBadges(vehicleIds = null) {
  if (Array.isArray(vehicleIds) && vehicleIds.length === 0) {
    return { data: [], error: null };
  }

  let query = supabase
    .from("active_vehicle_prebooking_badges")
    .select(activePrebookingBadgeColumns);

  if (Array.isArray(vehicleIds)) {
    query = query.in("vehicle_id", vehicleIds);
  }

  const response = await query;

  if (response.error) {
    return { data: [], error: response.error };
  }

  return {
    data: response.data ?? [],
    error: null,
  };
}

function buildPrebookingMap(prebookings = []) {
  return Object.fromEntries(
    prebookings
      .filter((prebooking) => prebooking?.vehicle_id)
      .map((prebooking) => [prebooking.vehicle_id, prebooking])
  );
}

async function fetchPrebookedVehicleIds() {
  const response = await fetchActivePrebookingBadges();

  if (response.error) {
    return { data: [], error: response.error };
  }

  return {
    data: uniqueValues(response.data.map((prebooking) => prebooking.vehicle_id)),
    error: null,
  };
}

async function fetchPrebookingSearchVehicleIds(searchText) {
  const searchPattern = getSearchPattern(searchText);

  if (!searchPattern) {
    return { data: [], error: null };
  }

  const response = await supabase
    .from("vehicle_prebookings")
    .select("vehicle_id")
    .eq("status", "active")
    .or(
      [
        `customer_name.ilike.${searchPattern}`,
        `customer_phone.ilike.${searchPattern}`,
        `customer_email.ilike.${searchPattern}`,
      ].join(",")
    );

  if (response.error) {
    return { data: [], error: response.error };
  }

  return {
    data: uniqueValues((response.data ?? []).map((record) => record.vehicle_id)),
    error: null,
  };
}

async function fetchVehicleCount(activeTab, activeStatusFilter) {
  const query = supabase
    .from("vehicles")
    .select("id", { count: "exact", head: true });

  const response = await applyVehicleQueryFilters(query, {
    activeStatusFilter,
    activeTab,
    searchText: "",
    titleStatusFilter: "all",
  });

  if (response.error) {
    throw response.error;
  }

  return response.count ?? 0;
}

async function fetchVehicleCounts() {
  const [
    active,
    readyForSale,
    allActive,
    inspection,
    repair,
    qualityCheck,
  ] = await Promise.all([
    fetchVehicleCount("active", "all_active"),
    fetchVehicleCount("ready_for_sale", "all_active"),
    fetchVehicleCount("active", "all_active"),
    fetchVehicleCount("active", "inspection"),
    fetchVehicleCount("active", "repair"),
    fetchVehicleCount("active", "quality_check"),
  ]);

  return {
    active,
    activeFilters: {
      all_active: allActive,
      inspection,
      quality_check: qualityCheck,
      repair,
    },
    ready_for_sale: readyForSale,
  };
}

async function fetchVehiclesWithPhotos({
  activeStatusFilter,
  activeTab,
  canSearchPrebookings = false,
  hasPrebookingFilter = false,
  hasThirdPartyFilter = false,
  page = 0,
  searchText = "",
  titleStatusFilter = "all",
}) {
  const from = page * VEHICLES_PAGE_SIZE;
  const to = from + VEHICLES_PAGE_SIZE - 1;
  let thirdPartyVehicleIds = null;
  let prebookedVehicleIds = null;
  let prebookingSearchVehicleIds = null;

  if (canSearchPrebookings && searchText.trim()) {
    const prebookingSearchResponse =
      await fetchPrebookingSearchVehicleIds(searchText);

    if (prebookingSearchResponse.error) {
      return { data: null, error: prebookingSearchResponse.error };
    }

    prebookingSearchVehicleIds = prebookingSearchResponse.data;
  }

  if (hasPrebookingFilter) {
    const prebookedVehicleIdsResponse = await fetchPrebookedVehicleIds();

    if (prebookedVehicleIdsResponse.error) {
      return { data: null, error: prebookedVehicleIdsResponse.error };
    }

    prebookedVehicleIds = prebookedVehicleIdsResponse.data;

    if (prebookedVehicleIds.length === 0) {
      return {
        data: {
          count: 0,
          prebookingsByVehicleId: {},
          thirdPartyVehiclesByVehicleId: {},
          vehiclePhotosByVehicleId: {},
          vehicles: [],
        },
        error: null,
      };
    }
  }

  if (hasThirdPartyFilter) {
    const thirdPartyVehicleIdsResponse = await fetchThirdPartyRepairVehicleIds();

    if (thirdPartyVehicleIdsResponse.error) {
      return { data: null, error: thirdPartyVehicleIdsResponse.error };
    }

    thirdPartyVehicleIds = thirdPartyVehicleIdsResponse.data;

    if (thirdPartyVehicleIds.length === 0) {
      return {
        data: {
          count: 0,
          prebookingsByVehicleId: {},
          thirdPartyVehiclesByVehicleId: {},
          vehiclePhotosByVehicleId: {},
          vehicles: [],
        },
        error: null,
      };
    }
  }

  const baseQuery = supabase
    .from("vehicles")
    .select(vehicleColumns, { count: "exact" });
  const vehiclesResponse = await applyVehicleQueryFilters(baseQuery, {
    activeStatusFilter,
    activeTab,
    prebookedVehicleIds,
    prebookingSearchVehicleIds,
    searchText,
    thirdPartyVehicleIds,
    titleStatusFilter,
  })
    .order("created_at", { ascending: false, nullsFirst: false })
    .order("stock_number", { ascending: false })
    .range(from, to);

  if (vehiclesResponse.error) {
    return { data: null, error: vehiclesResponse.error };
  }

  const vehicles = vehiclesResponse.data ?? [];
  const vehicleIds = uniqueValues(vehicles.map((vehicle) => vehicle.id));
  const primaryPhotoIds = [
    ...new Set(vehicles.map((vehicle) => vehicle.primary_photo_id).filter(Boolean)),
  ];
  const [
    photosResponse,
    thirdPartyVehicleMapResponse,
    prebookingBadgesResponse,
  ] = await Promise.all([
    primaryPhotoIds.length > 0
      ? supabase
          .from("vehicle_photos")
          .select(vehiclePhotoColumns)
          .in("id", primaryPhotoIds)
      : { data: [], error: null },
    fetchThirdPartyRepairVehicleMap(vehicleIds),
    fetchActivePrebookingBadges(vehicleIds),
  ]);

  if (photosResponse.error) {
    console.error("Could not load vehicle photos:", photosResponse.error);
  }

  if (thirdPartyVehicleMapResponse.error) {
    console.error(
      "Could not load third-party repair vehicle badges:",
      thirdPartyVehicleMapResponse.error
    );
  }

  if (prebookingBadgesResponse.error) {
    console.error(
      "Could not load vehicle prebooking badges:",
      prebookingBadgesResponse.error
    );
  }

  return {
    data: {
      count: vehiclesResponse.count ?? vehicles.length,
      prebookingsByVehicleId: prebookingBadgesResponse.error
        ? {}
        : buildPrebookingMap(prebookingBadgesResponse.data),
      thirdPartyVehiclesByVehicleId: thirdPartyVehicleMapResponse.error
        ? {}
        : thirdPartyVehicleMapResponse.data,
      vehiclePhotosByVehicleId: photosResponse.error
        ? {}
        : buildVehiclePrimaryPhotoMap(vehicles, photosResponse.data ?? []),
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

function getInventoryChipKey(chip) {
  return `${chip.type}-${chip.key}`;
}

function InventoryFilterChip({ buttonRef, count, icon, isActive, label, onClick }) {
  return (
    <button
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-black shadow-sm transition ${
        isActive
          ? "border-emerald-600 bg-emerald-600 text-white shadow-emerald-100"
          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-100 hover:bg-emerald-50/40"
      }`}
      onClick={onClick}
      ref={buttonRef}
      type="button"
    >
      <AppIcon
        className={isActive ? "text-white" : "text-slate-500"}
        name={icon}
        size={17}
      />
      <span className="whitespace-nowrap">{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs leading-none ${
          isActive
            ? "bg-white text-emerald-700"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function StatCard({ helperText, icon, label, tone = "emerald", value }) {
  const toneClassName =
    tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : tone === "violet"
        ? "bg-violet-50 text-violet-700"
        : tone === "slate"
          ? "bg-slate-100 text-slate-600"
          : "bg-emerald-50 text-emerald-700";

  return (
    <div className="flex min-w-44 items-center gap-3 border-slate-200 bg-white px-3 py-2.5 sm:border-r last:border-r-0">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneClassName}`}>
        <AppIcon name={icon} size={19} />
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

function getEmptyStateMessage({ activeStatusFilter, activeTab, hasFilters }) {
  if (hasFilters) {
    return {
      body: "Try adjusting your search or filters.",
      title: "No vehicles match your search or filters.",
    };
  }

  if (activeTab === "ready_for_sale") {
    return {
      body: "Vehicles will appear here after the final checklist is complete.",
      title: "No vehicles ready for sale.",
    };
  }

  if (activeStatusFilter === "inspection") {
    return {
      body: "New intake vehicles will appear here.",
      title: "No vehicles in inspection.",
    };
  }

  if (activeStatusFilter === "repair") {
    return {
      body: "Vehicles move here after work orders or parts are added.",
      title: "No vehicles in repair.",
    };
  }

  if (activeStatusFilter === "quality_check") {
    return {
      body: "Vehicles move here after final checklist work starts.",
      title: "No vehicles in quality check.",
    };
  }

  return {
    body: "New intake vehicles will appear here.",
    title: "No active vehicles.",
  };
}

function VehiclesPage({
  currentProfile,
  onOpenVehicleFile,
  onSelectVehicle,
}) {
  const [vehicles, setVehicles] = useState([]);
  const [vehiclePhotosByVehicleId, setVehiclePhotosByVehicleId] = useState({});
  const [prebookingsByVehicleId, setPrebookingsByVehicleId] = useState({});
  const [thirdPartyVehiclesByVehicleId, setThirdPartyVehiclesByVehicleId] =
    useState({});
  const [activeTab, setActiveTab] = useState("active");
  const [activeStatusFilter, setActiveStatusFilter] = useState("all_active");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [titleStatusFilter, setTitleStatusFilter] = useState("all");
  const [hasPrebookingFilter, setHasPrebookingFilter] = useState(false);
  const [hasThirdPartyFilter, setHasThirdPartyFilter] = useState(false);
  const [areFiltersOpen, setAreFiltersOpen] = useState(false);
  const [counts, setCounts] = useState({
    active: 0,
    activeFilters: {
      all_active: 0,
      inspection: 0,
      quality_check: 0,
      repair: 0,
    },
    ready_for_sale: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedPrebookingVehicle, setSelectedPrebookingVehicle] =
    useState(null);
  const [selectedPrebooking, setSelectedPrebooking] = useState(null);
  const filterButtonRef = useRef(null);
  const filterPanelRef = useRef(null);
  const canManagePrebooking = hasPermission(currentProfile?.role, "sale:manage");
  const activeInventoryChipKey =
    activeTab === "ready_for_sale"
      ? "tab-ready_for_sale"
      : activeStatusFilter === "all_active"
        ? "tab-active"
        : `status-${activeStatusFilter}`;
  const inventoryChipRefs = useActiveTabScroll(activeInventoryChipKey);

  useDismissableLayer({
    enabled: areFiltersOpen,
    onDismiss: () => setAreFiltersOpen(false),
    refs: [filterButtonRef, filterPanelRef],
  });

  useEffect(() => {
    let isMounted = true;

    async function loadCounts() {
      try {
        const nextCounts = await fetchVehicleCounts();

        if (isMounted) {
          setCounts(nextCounts);
        }
      } catch (error) {
        console.error("Could not load vehicle counts:", error);
      }
    }

    loadCounts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchText]);

  useEffect(() => {
    let isMounted = true;

    async function loadVehicles() {
      setIsLoading(true);
      setPage(0);
      setTotalCount(0);
      setErrorMessage("");

      try {
        const { data, error } = await fetchVehiclesWithPhotos({
          activeStatusFilter,
          activeTab,
          canSearchPrebookings: canManagePrebooking,
          hasPrebookingFilter,
          hasThirdPartyFilter,
          page: 0,
          searchText: debouncedSearchText,
          titleStatusFilter,
        });

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("Could not load vehicles:", error);
          setErrorMessage("Could not load vehicles.");
          setVehicles([]);
          setPrebookingsByVehicleId({});
          setVehiclePhotosByVehicleId({});
          setThirdPartyVehiclesByVehicleId({});
          return;
        }

        setVehicles(data.vehicles);
        setPrebookingsByVehicleId(data.prebookingsByVehicleId);
        setVehiclePhotosByVehicleId(data.vehiclePhotosByVehicleId);
        setThirdPartyVehiclesByVehicleId(data.thirdPartyVehiclesByVehicleId);
        setTotalCount(data.count);
      } catch (error) {
        if (isMounted) {
          console.error("Could not load vehicles:", error);
          setErrorMessage("Could not load vehicles.");
          setVehicles([]);
          setPrebookingsByVehicleId({});
          setVehiclePhotosByVehicleId({});
          setThirdPartyVehiclesByVehicleId({});
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadVehicles();

    return () => {
      isMounted = false;
    };
  }, [
    activeStatusFilter,
    activeTab,
    canManagePrebooking,
    debouncedSearchText,
    hasPrebookingFilter,
    hasThirdPartyFilter,
    titleStatusFilter,
  ]);

  function clearFilters() {
    setSearchText("");
    setActiveStatusFilter("all_active");
    setHasPrebookingFilter(false);
    setHasThirdPartyFilter(false);
    setTitleStatusFilter("all");
  }

  function handleTitleStatusFilterChange(event) {
    setTitleStatusFilter(event.target.value);
    setAreFiltersOpen(false);
  }

  function handleThirdPartyFilterChange(event) {
    setHasThirdPartyFilter(event.target.checked);
    setAreFiltersOpen(false);
  }

  function handlePrebookingFilterChange(event) {
    setHasPrebookingFilter(event.target.checked);
    setAreFiltersOpen(false);
  }

  function handleTabChange(nextTab) {
    setActiveTab(nextTab);
    setActiveStatusFilter("all_active");
  }

  async function refreshVehicles() {
    if (isLoading || isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setErrorMessage("");

    try {
      const [dataResponse, nextCounts] = await Promise.all([
        fetchVehiclesWithPhotos({
          activeStatusFilter,
          activeTab,
          canSearchPrebookings: canManagePrebooking,
          hasPrebookingFilter,
          hasThirdPartyFilter,
          page: 0,
          searchText: debouncedSearchText,
          titleStatusFilter,
        }),
        fetchVehicleCounts(),
      ]);

      if (dataResponse.error) {
        console.error("Could not load vehicles:", dataResponse.error);
        setErrorMessage("Could not load vehicles.");
        return;
      }

      setCounts(nextCounts);
      setVehicles(dataResponse.data.vehicles);
      setPrebookingsByVehicleId(dataResponse.data.prebookingsByVehicleId);
      setVehiclePhotosByVehicleId(dataResponse.data.vehiclePhotosByVehicleId);
      setThirdPartyVehiclesByVehicleId(
        dataResponse.data.thirdPartyVehiclesByVehicleId
      );
      setTotalCount(dataResponse.data.count);
      setPage(0);
    } catch (error) {
      console.error("Could not load vehicles:", error);
      setErrorMessage("Could not load vehicles.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function loadMoreVehicles() {
    if (isLoading || isLoadingMore || vehicles.length >= totalCount) {
      return;
    }

    const nextPage = page + 1;
    setIsLoadingMore(true);
    setErrorMessage("");

    try {
      const { data, error } = await fetchVehiclesWithPhotos({
        activeStatusFilter,
        activeTab,
        canSearchPrebookings: canManagePrebooking,
        hasPrebookingFilter,
        hasThirdPartyFilter,
        page: nextPage,
        searchText: debouncedSearchText,
        titleStatusFilter,
      });

      if (error) {
        console.error("Could not load more vehicles:", error);
        setErrorMessage("Could not load more vehicles.");
        return;
      }

      setVehicles((currentVehicles) => {
        const vehiclesById = new Map(
          currentVehicles.map((vehicle) => [vehicle.id, vehicle])
        );

        for (const vehicle of data.vehicles) {
          vehiclesById.set(vehicle.id, vehicle);
        }

        return [...vehiclesById.values()];
      });
      setVehiclePhotosByVehicleId((currentPhotos) => ({
        ...currentPhotos,
        ...data.vehiclePhotosByVehicleId,
      }));
      setPrebookingsByVehicleId((currentPrebookings) => ({
        ...currentPrebookings,
        ...data.prebookingsByVehicleId,
      }));
      setThirdPartyVehiclesByVehicleId((currentThirdPartyVehicles) => ({
        ...currentThirdPartyVehicles,
        ...data.thirdPartyVehiclesByVehicleId,
      }));
      setTotalCount(data.count);
      setPage(nextPage);
    } catch (error) {
      console.error("Could not load more vehicles:", error);
      setErrorMessage("Could not load more vehicles.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  const activeFilterCount = getActiveFilterCount(
    searchText,
    titleStatusFilter,
    hasThirdPartyFilter,
    hasPrebookingFilter
  );
  const hasActiveFilters = activeFilterCount > 0;
  const hasMoreVehicles = vehicles.length < totalCount;
  const emptyMessage = getEmptyStateMessage({
    activeStatusFilter,
    activeTab,
    hasFilters: hasActiveFilters,
  });
  const totalVehicleCount = counts.active + counts.ready_for_sale;

  function isChipActive(chip) {
    if (chip.type === "tab") {
      return activeTab === chip.key && activeStatusFilter === "all_active";
    }

    return activeTab === "active" && activeStatusFilter === chip.key;
  }

  function getChipCount(chip) {
    if (chip.key === "active") {
      return counts.active;
    }

    if (chip.key === "ready_for_sale") {
      return counts.ready_for_sale;
    }

    return counts.activeFilters[chip.key] ?? 0;
  }

  function handleFilterChipClick(chip) {
    if (chip.type === "tab") {
      handleTabChange(chip.key);
      return;
    }

    setActiveTab("active");
    setActiveStatusFilter(chip.key);
  }

  function handlePrebookingClick(vehicle, prebooking) {
    if (!canManagePrebooking || !prebooking) {
      return;
    }

    setSelectedPrebookingVehicle(vehicle);
    setSelectedPrebooking(prebooking);
  }

  async function handlePrebookingSaved(savedPrebooking) {
    if (savedPrebooking?.vehicle_id) {
      setPrebookingsByVehicleId((currentPrebookings) => {
        const nextPrebookings = { ...currentPrebookings };

        if (savedPrebooking.status === "active") {
          nextPrebookings[savedPrebooking.vehicle_id] = savedPrebooking;
        } else {
          delete nextPrebookings[savedPrebooking.vehicle_id];
        }

        return nextPrebookings;
      });
    }

    setSelectedPrebookingVehicle(null);
    setSelectedPrebooking(null);
    await refreshVehicles();
  }

  return (
    <div className="space-y-5">
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
                placeholder="Search stock, VIN, make, model, trim, or color"
                type="search"
                value={searchText}
              />
            </div>
          </label>

          <div className="flex gap-2">
            <button
              aria-expanded={areFiltersOpen}
              aria-haspopup="menu"
              className={`inline-flex h-12 w-12 items-center justify-center gap-1.5 rounded-2xl border px-0 text-sm font-bold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:w-auto sm:gap-2 sm:px-4 ${
                areFiltersOpen
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => setAreFiltersOpen((isOpen) => !isOpen)}
              ref={filterButtonRef}
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
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading || isRefreshing}
              onClick={refreshVehicles}
              title="Refresh vehicles"
              type="button"
            >
              <AppIcon
                className={isRefreshing ? "animate-spin" : ""}
                name="refresh"
                size={18}
              />
            </button>
          </div>
        </div>

        {areFiltersOpen && (
          <div
            className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:max-w-md"
            ref={filterPanelRef}
          >
            <FilterSelect
              id="vehicle-title-status-filter"
              label="Title Status"
              onChange={handleTitleStatusFilterChange}
              value={titleStatusFilter}
            >
              <option value="all">All Titles</option>
              {titleStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FilterSelect>

            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50">
              <input
                checked={hasPrebookingFilter}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                onChange={handlePrebookingFilterChange}
                type="checkbox"
              />
              <AppIcon className="text-indigo-600" name="dollar" size={17} />
              <span>Prebooked</span>
            </label>

            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50">
              <input
                checked={hasThirdPartyFilter}
                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-200"
                onChange={handleThirdPartyFilterChange}
                type="checkbox"
              />
              <AppIcon className="text-violet-600" name="third-party" size={17} />
              <span>Has 3rd-Party Repair</span>
            </label>
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {inventoryFilterChips.map((chip) => (
              <InventoryFilterChip
                buttonRef={(element) => {
                  inventoryChipRefs.current[getInventoryChipKey(chip)] = element;
                }}
                count={getChipCount(chip)}
                icon={chip.icon}
                isActive={isChipActive(chip)}
                key={`${chip.type}-${chip.key}`}
                label={chip.label}
                onClick={() => handleFilterChipClick(chip)}
              />
            ))}
          </div>

          {hasActiveFilters && (
            <button
              className="mt-2 w-fit rounded-xl px-1 text-sm font-semibold text-emerald-700 transition hover:text-emerald-800"
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          <StatCard
            helperText="Inspection, repair, quality check"
            icon="car"
            label="Active"
            value={counts.active}
          />
          <StatCard
            helperText="Cleared for sale"
            icon="chart-up"
            label="Ready for Sale"
            tone="blue"
            value={counts.ready_for_sale}
          />
          <StatCard
            helperText="Vehicles"
            icon="checklist"
            label="Inspection"
            tone="slate"
            value={counts.activeFilters.inspection}
          />
          <StatCard
            helperText="In inventory"
            icon="box"
            label="Total Vehicles"
            tone="slate"
            value={totalVehicleCount}
          />
        </div>
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
            {emptyMessage.title}
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            {emptyMessage.body}
          </p>
          {hasActiveFilters && (
            <button
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              onClick={clearFilters}
              type="button"
            >
              Clear Filters
            </button>
          )}
        </section>
      )}

      {!isLoading && !errorMessage && vehicles.length > 0 && (
        <>
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {vehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                canManagePrebooking={canManagePrebooking}
                onOpenVehicleFile={onOpenVehicleFile}
                onSelectVehicle={onSelectVehicle}
                onPrebookingClick={handlePrebookingClick}
                hasThirdPartyRepair={
                  thirdPartyVehiclesByVehicleId[vehicle.id] === true
                }
                photo={vehiclePhotosByVehicleId[vehicle.id]}
                prebooking={prebookingsByVehicleId[vehicle.id]}
                vehicle={{
                  ...vehicle,
                  status: normalizeVehicleStatus(vehicle.status),
                }}
              />
            ))}
          </section>

          {hasMoreVehicles && (
            <div className="flex justify-center">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoadingMore}
                onClick={loadMoreVehicles}
                type="button"
              >
                {isLoadingMore
                  ? "Loading..."
                  : `Load More (${vehicles.length}/${totalCount})`}
              </button>
            </div>
          )}
        </>
      )}

      {selectedPrebooking && canManagePrebooking && (
        <VehiclePrebookingModal
          currentProfile={currentProfile}
          onClose={() => {
            setSelectedPrebooking(null);
            setSelectedPrebookingVehicle(null);
          }}
          onSaved={handlePrebookingSaved}
          prebooking={selectedPrebooking}
          vehicle={selectedPrebookingVehicle}
          vehicleId={selectedPrebookingVehicle?.id}
        />
      )}
    </div>
  );
}

export default VehiclesPage;
