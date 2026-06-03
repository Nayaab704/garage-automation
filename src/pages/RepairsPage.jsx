import { useEffect, useMemo, useState } from "react";
import StatusDropdown from "../components/vehicle-detail/StatusDropdown";
import { logVehicleActivity } from "../lib/activityLogger";
import { hasPermission } from "../lib/permissions";
import { getPhaseOneServiceCategories } from "../lib/serviceCategoryVisuals";
import { supabase } from "../lib/supabaseClient";

const repairJobColumns =
  "id, vehicle_id, service_category_id, title, category, priority, status, assigned_to, created_by, notes, created_at, completed_at";

const statusOptions = [
  "needed",
  "approved",
  "in_progress",
  "waiting_parts",
  "blocked",
  "completed",
  "cancelled",
];

const priorityOptions = ["low", "medium", "high", "urgent"];

const statusLabels = {
  approved: "Approved",
  blocked: "Blocked",
  cancelled: "Cancelled",
  completed: "Completed",
  in_progress: "In Progress",
  needed: "Needed",
  waiting_parts: "Waiting Parts",
};

const priorityLabels = {
  high: "High",
  low: "Low",
  medium: "Medium",
  urgent: "Urgent",
};

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
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

function formatLabel(value, labels) {
  if (labels[value]) {
    return labels[value];
  }

  if (!value) {
    return "Not available";
  }

  return String(value)
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getVehicleName(vehicle) {
  if (!vehicle) {
    return "Vehicle not found";
  }

  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
}

function getVehicleSearchText(workOrder, vehicle) {
  return [
    workOrder.title,
    vehicle?.stock_number,
    vehicle?.make,
    vehicle?.model,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getProfileName(profile) {
  return profile?.full_name || profile?.email || "Not assigned";
}

function getServiceCategoryLabel(workOrder, serviceCategoriesById) {
  const serviceCategory = serviceCategoriesById[workOrder.service_category_id];

  if (serviceCategory?.name) {
    return serviceCategory.name;
  }

  return formatLabel(workOrder.category, {});
}

function priorityClassName(priority) {
  if (priority === "urgent") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (priority === "high") {
    return "bg-orange-50 text-orange-700 ring-orange-200";
  }

  if (priority === "medium") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function statusClassName(status) {
  if (status === "completed") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "blocked" || status === "cancelled") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "approved" || status === "in_progress") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (status === "waiting_parts") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function workOrderMatchesFilters({
  activeMyWorkOnly,
  currentProfile,
  priorityFilter,
  searchTerm,
  selectedServiceCategoryId,
  selectedTechnicianId,
  serviceCategoriesById,
  statusFilter,
  vehicle,
  workOrder,
}) {
  if (
    activeMyWorkOnly &&
    workOrder.assigned_to !== currentProfile?.id &&
    workOrder.created_by !== currentProfile?.id
  ) {
    return false;
  }

  if (
    selectedTechnicianId !== "all" &&
    workOrder.assigned_to !== selectedTechnicianId &&
    workOrder.created_by !== selectedTechnicianId
  ) {
    return false;
  }

  if (statusFilter !== "all" && workOrder.status !== statusFilter) {
    return false;
  }

  if (priorityFilter !== "all" && workOrder.priority !== priorityFilter) {
    return false;
  }

  if (
    selectedServiceCategoryId !== "all" &&
    workOrder.service_category_id !== selectedServiceCategoryId
  ) {
    return false;
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const categoryName = getServiceCategoryLabel(workOrder, serviceCategoriesById);
  const searchableText = `${getVehicleSearchText(
    workOrder,
    vehicle
  )} ${categoryName.toLowerCase()}`;

  return searchableText.includes(normalizedSearch);
}

async function fetchRepairsQueueData() {
  const repairJobsResponse = await supabase
    .from("repair_jobs")
    .select(repairJobColumns)
    .order("created_at", { ascending: false });

  if (repairJobsResponse.error) {
    return { error: repairJobsResponse.error };
  }

  const workOrders = repairJobsResponse.data ?? [];
  const vehicleIds = uniqueValues(workOrders.map((workOrder) => workOrder.vehicle_id));

  const [vehiclesResponse, serviceCategoriesResponse, profilesResponse] =
    await Promise.all([
      vehicleIds.length > 0
        ? supabase
            .from("vehicles")
            .select("id, stock_number, vin, year, make, model, status")
            .in("id", vehicleIds)
        : { data: [], error: null },
      supabase
        .from("service_categories")
        .select("id, slug, name, is_active, sort_order")
        .order("sort_order", { ascending: true }),
      supabase.from("profiles").select("id, full_name, email, role"),
    ]);

  const firstRelatedError =
    vehiclesResponse.error ??
    serviceCategoriesResponse.error ??
    profilesResponse.error;

  if (firstRelatedError) {
    return { error: firstRelatedError };
  }

  return {
    data: {
      profiles: profilesResponse.data ?? [],
      serviceCategories: serviceCategoriesResponse.data ?? [],
      vehiclesById: Object.fromEntries(
        (vehiclesResponse.data ?? []).map((vehicle) => [vehicle.id, vehicle])
      ),
      workOrders,
    },
    error: null,
  };
}

function Badge({ children, className }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-zinc-950">{value}</p>
    </div>
  );
}

function RepairsPage({ currentProfile, onSelectVehicle }) {
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [myWorkOnly, setMyWorkOnly] = useState(
    () => currentProfile?.role === "technician"
  );
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [profiles, setProfiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedServiceCategoryId, setSelectedServiceCategoryId] =
    useState("all");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("all");
  const [serviceCategories, setServiceCategories] = useState([]);
  const [statusErrorMessage, setStatusErrorMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [vehiclesById, setVehiclesById] = useState({});
  const [workOrders, setWorkOrders] = useState([]);

  const role = currentProfile?.role;
  const canManageRepairJobs = hasPermission(role, "repair:manage");
  const canUseTechnicianFilter = role === "admin" || role === "owner";

  const profilesById = useMemo(
    () => Object.fromEntries(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );
  const serviceCategoriesById = useMemo(
    () =>
      Object.fromEntries(
        serviceCategories.map((serviceCategory) => [
          serviceCategory.id,
          serviceCategory,
        ])
      ),
    [serviceCategories]
  );
  const technicians = useMemo(
    () =>
      profiles.filter((profile) =>
        ["technician", "admin", "owner"].includes(profile.role)
      ),
    [profiles]
  );
  const activeServiceCategories = useMemo(
    () =>
      getPhaseOneServiceCategories(
        serviceCategories.filter((serviceCategory) => serviceCategory.is_active)
      ),
    [serviceCategories]
  );

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((workOrder) =>
      workOrderMatchesFilters({
        activeMyWorkOnly: myWorkOnly,
        currentProfile,
        priorityFilter,
        searchTerm,
        selectedServiceCategoryId,
        selectedTechnicianId: canUseTechnicianFilter
          ? selectedTechnicianId
          : "all",
        serviceCategoriesById,
        statusFilter,
        vehicle: vehiclesById[workOrder.vehicle_id],
        workOrder,
      })
    );
  }, [
    canUseTechnicianFilter,
    currentProfile,
    myWorkOnly,
    priorityFilter,
    searchTerm,
    selectedServiceCategoryId,
    selectedTechnicianId,
    serviceCategoriesById,
    statusFilter,
    vehiclesById,
    workOrders,
  ]);

  const summary = useMemo(() => {
    return {
      blocked: filteredWorkOrders.filter((workOrder) => workOrder.status === "blocked")
        .length,
      completed: filteredWorkOrders.filter(
        (workOrder) => workOrder.status === "completed"
      ).length,
      inProgress: filteredWorkOrders.filter(
        (workOrder) => workOrder.status === "in_progress"
      ).length,
      total: filteredWorkOrders.length,
      waitingParts: filteredWorkOrders.filter(
        (workOrder) => workOrder.status === "waiting_parts"
      ).length,
    };
  }, [filteredWorkOrders]);

  useEffect(() => {
    let isMounted = true;

    async function loadRepairs() {
      try {
        const { data, error } = await fetchRepairsQueueData();

        if (!isMounted) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        setWorkOrders(data.workOrders);
        setVehiclesById(data.vehiclesById);
        setServiceCategories(data.serviceCategories);
        setProfiles(data.profiles);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message ?? "Unable to load work orders.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRepairs();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleStatusChange(workOrder, newStatus) {
    if (!canManageRepairJobs) {
      setStatusErrorMessage("Your role cannot update work orders.");
      return;
    }

    if (!statusOptions.includes(newStatus)) {
      setStatusErrorMessage("That status is not allowed for work orders.");
      return;
    }

    const previousStatus = workOrder.status;

    setStatusErrorMessage("");
    setUpdatingStatusId(workOrder.id);
    setWorkOrders((currentWorkOrders) =>
      currentWorkOrders.map((currentWorkOrder) =>
        currentWorkOrder.id === workOrder.id
          ? { ...currentWorkOrder, status: newStatus }
          : currentWorkOrder
      )
    );

    try {
      const { error } = await supabase
        .from("repair_jobs")
        .update({ status: newStatus })
        .eq("id", workOrder.id);

      if (error) {
        setWorkOrders((currentWorkOrders) =>
          currentWorkOrders.map((currentWorkOrder) =>
            currentWorkOrder.id === workOrder.id
              ? { ...currentWorkOrder, status: previousStatus }
              : currentWorkOrder
          )
        );
        setStatusErrorMessage(error.message);
        return;
      }

      await logVehicleActivity({
        vehicleId: workOrder.vehicle_id,
        action: "Repair job status changed",
        details: {
          from: previousStatus,
          title: workOrder.title,
          to: newStatus,
        },
      });
    } catch (error) {
      setWorkOrders((currentWorkOrders) =>
        currentWorkOrders.map((currentWorkOrder) =>
          currentWorkOrder.id === workOrder.id
            ? { ...currentWorkOrder, status: previousStatus }
            : currentWorkOrder
        )
      );
      setStatusErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  function clearFilters() {
    setPriorityFilter("all");
    setSearchTerm("");
    setSelectedServiceCategoryId("all");
    setSelectedTechnicianId("all");
    setStatusFilter("all");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Repairs Queue
            </p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">
              Work Orders
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Review service work across vehicles, track technician workload,
              and update work order status from one queue.
            </p>
          </div>

          <label className="flex w-fit items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
            <input
              checked={myWorkOnly}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-400"
              onChange={(event) => setMyWorkOnly(event.target.checked)}
              type="checkbox"
            />
            My Work
          </label>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Work Orders" value={summary.total} />
        <SummaryCard label="In Progress" value={summary.inProgress} />
        <SummaryCard label="Waiting Parts" value={summary.waitingParts} />
        <SummaryCard label="Completed" value={summary.completed} />
        <SummaryCard label="Blocked" value={summary.blocked} />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <label className="block xl:col-span-2" htmlFor="repair-search">
            <span className="text-sm font-medium text-zinc-700">Search</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="repair-search"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Title, stock, make, or model"
              type="search"
              value={searchTerm}
            />
          </label>

          <label className="block" htmlFor="repair-status-filter">
            <span className="text-sm font-medium text-zinc-700">Status</span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="repair-status-filter"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="all">All Statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status, statusLabels)}
                </option>
              ))}
            </select>
          </label>

          <label className="block" htmlFor="repair-priority-filter">
            <span className="text-sm font-medium text-zinc-700">Priority</span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="repair-priority-filter"
              onChange={(event) => setPriorityFilter(event.target.value)}
              value={priorityFilter}
            >
              <option value="all">All Priorities</option>
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {formatLabel(priority, priorityLabels)}
                </option>
              ))}
            </select>
          </label>

          <label className="block" htmlFor="repair-category-filter">
            <span className="text-sm font-medium text-zinc-700">
              Service Category
            </span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="repair-category-filter"
              onChange={(event) => setSelectedServiceCategoryId(event.target.value)}
              value={selectedServiceCategoryId}
            >
              <option value="all">All Categories</option>
              {activeServiceCategories.map((serviceCategory) => (
                <option key={serviceCategory.id} value={serviceCategory.id}>
                  {serviceCategory.name}
                </option>
              ))}
            </select>
          </label>

          {canUseTechnicianFilter && (
            <label className="block" htmlFor="repair-technician-filter">
              <span className="text-sm font-medium text-zinc-700">
                Technician
              </span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="repair-technician-filter"
                onChange={(event) => setSelectedTechnicianId(event.target.value)}
                value={selectedTechnicianId}
              >
                <option value="all">All Technicians</option>
                {technicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {getProfileName(technician)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-500">
            Showing {filteredWorkOrders.length} of {workOrders.length} work
            orders
          </p>
          <button
            className="w-fit rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            onClick={clearFilters}
            type="button"
          >
            Clear Filters
          </button>
        </div>
      </section>

      {statusErrorMessage && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {statusErrorMessage}
        </section>
      )}

      {isLoading && (
        <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-zinc-700">Loading work orders...</p>
        </section>
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMessage}
        </section>
      )}

      {!isLoading && !errorMessage && filteredWorkOrders.length === 0 && (
        <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm">
          <h3 className="text-lg font-bold text-zinc-950">
            No work orders found
          </h3>
          <p className="mt-2 text-sm text-zinc-500">
            Try adjusting your filters, or add work orders from a vehicle detail
            page.
          </p>
        </section>
      )}

      {!isLoading && !errorMessage && filteredWorkOrders.length > 0 && (
        <section className="space-y-3">
          {filteredWorkOrders.map((workOrder) => {
            const vehicle = vehiclesById[workOrder.vehicle_id];
            const assignedTechnician = profilesById[workOrder.assigned_to];
            const creator = profilesById[workOrder.created_by];
            const serviceCategory = getServiceCategoryLabel(
              workOrder,
              serviceCategoriesById
            );

            return (
              <article
                className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                key={workOrder.id}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-zinc-950">
                        {displayValue(workOrder.title)}
                      </h3>
                      <Badge className={priorityClassName(workOrder.priority)}>
                        {formatLabel(workOrder.priority, priorityLabels)}
                      </Badge>
                    </div>

                    <p className="mt-2 text-sm font-medium text-zinc-700">
                      {displayValue(vehicle?.stock_number)} -{" "}
                      {displayValue(getVehicleName(vehicle))}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {displayValue(serviceCategory)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-start gap-2 xl:justify-end">
                    {canManageRepairJobs ? (
                      <StatusDropdown
                        currentStatus={workOrder.status}
                        isUpdating={updatingStatusId === workOrder.id}
                        onChange={(newStatus) =>
                          handleStatusChange(workOrder, newStatus)
                        }
                        statuses={statusOptions}
                      />
                    ) : (
                      <Badge className={statusClassName(workOrder.status)}>
                        {formatLabel(workOrder.status, statusLabels)}
                      </Badge>
                    )}
                    <button
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!workOrder.vehicle_id}
                      onClick={() => onSelectVehicle?.(workOrder.vehicle_id)}
                      type="button"
                    >
                      View Vehicle
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-zinc-500">Assigned Technician</p>
                    <p className="mt-1 font-medium text-zinc-800">
                      {getProfileName(assignedTechnician)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Created By</p>
                    <p className="mt-1 font-medium text-zinc-800">
                      {getProfileName(creator)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Vehicle Status</p>
                    <p className="mt-1 font-medium text-zinc-800">
                      {formatLabel(vehicle?.status, {})}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Created Date</p>
                    <p className="mt-1 font-medium text-zinc-800">
                      {formatDate(workOrder.created_at)}
                    </p>
                  </div>
                </div>

                {workOrder.notes && (
                  <p className="mt-4 whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
                    {workOrder.notes}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

export default RepairsPage;
