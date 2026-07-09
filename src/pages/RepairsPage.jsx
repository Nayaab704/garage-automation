import { useEffect, useMemo, useState } from "react";
import AppIcon from "../components/ui/AppIcon";
import PriorityBadge from "../components/ui/PriorityBadge";
import StatusBadge from "../components/ui/StatusBadge";
import { buttonClassNames } from "../components/ui/uiStyles";
import AddWorkOrderLaborForm from "../components/vehicle-detail/AddWorkOrderLaborForm";
import AddWorkOrderPartForm from "../components/vehicle-detail/AddWorkOrderPartForm";
import AddWorkOrderPhotoForm from "../components/vehicle-detail/AddWorkOrderPhotoForm";
import StatusDropdown from "../components/vehicle-detail/StatusDropdown";
import { logVehicleActivity } from "../lib/activityLogger";
import { hasPermission } from "../lib/permissions";
import {
  fetchRepairsQueue,
  filterRepairsQueueResults,
} from "../lib/repairsQueue";
import {
  formatRepairJobVehicleLabel,
  formatRepairLabel,
  getRepairJobCounts,
  getRepairQueueCounts,
  REPAIR_QUEUE_TABS,
} from "../lib/repairWorkflowUtils";
import { supabase } from "../lib/supabaseClient";
import {
  getWorkOrderStatusAfterPartAdded,
  getWorkOrderStatusAfterWorkStarted,
  workOrderStatusOptions,
} from "../lib/workOrderStatus";

const statusOptions = workOrderStatusOptions;

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

function formatHours(value) {
  const numberValue = Number(value ?? 0);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return "0h";
  }

  return `${Number(numberValue.toFixed(2))}h`;
}

function getProfileName(profile) {
  return profile?.full_name || profile?.email || "Not assigned";
}

function getServiceCategoryLabel(job) {
  return job?.serviceCategory?.name || formatRepairLabel(job?.category, {});
}

function RepairsQueueTabs({ activeTab, counts = {}, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {REPAIR_QUEUE_TABS.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-black transition ${
              isActive
                ? "bg-emerald-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            }`}
            key={tab.key}
            onClick={() => onChange(tab.key)}
            type="button"
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                isActive ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {counts[tab.key] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RepairJobEmptyState({ activeTab, hasSearch }) {
  const message = hasSearch
    ? {
        body: "Try a different stock number, vehicle, work order, service category, part, or vendor.",
        title: "No matching work orders found.",
      }
    : activeTab === "waiting_parts"
      ? {
          body: "Work orders with needed, ordered, or unreceived parts will appear here.",
          title: "No work orders are waiting for parts.",
        }
      : activeTab === "urgent"
        ? {
            body: "High and urgent work orders will appear here.",
            title: "No urgent work orders right now.",
          }
        : activeTab === "open"
          ? {
              body: "Work orders created from Vehicle Detail will appear here.",
              title: "No open work orders.",
            }
          : {
              body: "Work orders matching this queue tab will appear here.",
              title: "No work orders found.",
            };

  return (
    <section className="rounded-3xl border border-dashed border-slate-300 bg-white/90 p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <AppIcon name="wrench" size={24} />
      </div>
      <h3 className="mt-4 text-lg font-black text-slate-950">
        {message.title}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {message.body}
      </p>
    </section>
  );
}

function CountPill({ icon, label, value }) {
  return (
    <span
      aria-label={`${label}: ${value}`}
      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-inset ring-slate-100"
    >
      <AppIcon className="text-slate-400" name={icon} size={14} />
      <span className="text-slate-950">{value}</span>
    </span>
  );
}

function RepairJobCard({
  canManageLabor,
  canManageParts,
  canManagePhotos,
  canManageRepairJobs,
  isExpanded,
  isUpdating,
  onAddLabor,
  onAddPart,
  onAddPhoto,
  onOpenVehicle,
  onStatusChange,
  onToggleDetails,
  job,
}) {
  const counts = getRepairJobCounts(job);
  const vehicleLabel = formatRepairJobVehicleLabel(job);
  const serviceCategory = getServiceCategoryLabel(job);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-black leading-snug text-slate-950">
                {displayValue(job.title)}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <PriorityBadge priority={job.priority} />
                <StatusBadge status={job.status} />
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <p className="font-black text-slate-900">{vehicleLabel}</p>
            <p>
              <span className="font-semibold text-slate-800">
                {serviceCategory}
              </span>
              <span className="text-slate-500">
                {" "}
                - Created {formatDate(job.created_at)}
              </span>
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <CountPill
              icon="camera"
              label="Photos"
              value={job.photos.length}
            />
            <CountPill
              icon="clock"
              label="Labor"
              value={formatHours(counts.laborHours)}
            />
            <CountPill icon="box" label="Parts" value={counts.partsCount} />
            <CountPill
              icon="users"
              label="Third-party repairs"
              value={counts.thirdPartyCount}
            />
          </div>

          {isExpanded && (
            <div className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Assigned
                  </p>
                  <p className="mt-1 font-semibold text-slate-700">
                    {getProfileName(job.assignedProfile)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Created By
                  </p>
                  <p className="mt-1 font-semibold text-slate-700">
                    {getProfileName(job.createdByProfile)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Vehicle Status
                  </p>
                  <p className="mt-1 font-semibold text-slate-700">
                    {formatRepairLabel(job.vehicle?.status, {})}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Parts Waiting
                  </p>
                  <p className="mt-1 font-semibold text-slate-700">
                    {
                      job.parts.filter(
                        (part) =>
                          part.part_source === "needs_to_buy" &&
                          !["received", "installed", "cancelled"].includes(
                            part.status
                          )
                      ).length
                    }
                  </p>
                </div>
              </div>

              {job.notes && (
                <p className="whitespace-pre-wrap rounded-2xl bg-white p-3 text-sm leading-6 text-slate-600">
                  {job.notes}
                </p>
              )}

              {canManageRepairJobs && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Status
                  </span>
                  <StatusDropdown
                    currentStatus={job.status}
                    isUpdating={isUpdating}
                    onChange={(newStatus) => onStatusChange(job, newStatus)}
                    statuses={statusOptions}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:w-48 lg:flex-col lg:items-stretch">
          <button
            className={`${buttonClassNames.primary} flex-1 lg:w-full`}
            disabled={!job.vehicle_id}
            onClick={() => onOpenVehicle?.(job.vehicle_id)}
            type="button"
          >
            Open Vehicle
          </button>

          {canManageParts && (
            <button
              className={`${buttonClassNames.secondary} flex-1 lg:w-full`}
              onClick={() => onAddPart(job)}
              type="button"
            >
              Add Part
            </button>
          )}

          {canManageLabor && (
            <button
              className={`${buttonClassNames.secondary} flex-1 lg:w-full`}
              onClick={() => onAddLabor(job)}
              type="button"
            >
              Add Labor
            </button>
          )}

          {canManagePhotos && (
            <button
              className={`${buttonClassNames.secondary} flex-1 lg:w-full`}
              onClick={() => onAddPhoto(job)}
              type="button"
            >
              Add Photo
            </button>
          )}

          <button
            className={`${buttonClassNames.secondary} flex-1 lg:w-full`}
            onClick={() => onToggleDetails(job.id)}
            type="button"
          >
            {isExpanded ? "Hide Details" : "View Details"}
          </button>
        </div>
      </div>
    </article>
  );
}

function RepairsPage({ currentProfile, onSelectVehicle }) {
  const [activeTab, setActiveTab] = useState("open");
  const [activeLaborJob, setActiveLaborJob] = useState(null);
  const [activePartJob, setActivePartJob] = useState(null);
  const [activePhotoJob, setActivePhotoJob] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedJobIds, setExpandedJobIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusErrorMessage, setStatusErrorMessage] = useState("");
  const [statusSuccessMessage, setStatusSuccessMessage] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [vendors, setVendors] = useState([]);

  const role = currentProfile?.role;
  const canManageRepairJobs = hasPermission(role, "repair:manage");
  const canManagePartRequests = hasPermission(role, "part_request:manage");
  const canManageLabor = hasPermission(role, "labor:manage");
  const canManagePhotos = hasPermission(role, "photo:manage");
  const canManageWorkOrderParts = canManageRepairJobs || canManagePartRequests;

  const countsByTab = useMemo(() => getRepairQueueCounts(jobs), [jobs]);
  const filteredJobs = useMemo(
    () =>
      filterRepairsQueueResults(jobs, {
        search: searchTerm,
        tab: activeTab,
      }),
    [activeTab, jobs, searchTerm]
  );

  async function loadRepairsQueue({ showLoading = true } = {}) {
    if (showLoading) {
      setIsLoading(true);
    }

    setErrorMessage("");

    try {
      const { data, error } = await fetchRepairsQueue();

      if (error) {
        console.error("Could not load repairs:", error);
        setErrorMessage("Could not load repairs.");
        return;
      }

      setJobs(data.jobs);
      setProfiles(data.profiles);
      setVendors(data.vendors);
    } catch (error) {
      console.error("Could not load repairs:", error);
      setErrorMessage("Could not load repairs.");
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialRepairs() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data, error } = await fetchRepairsQueue();

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("Could not load repairs:", error);
          setErrorMessage("Could not load repairs.");
          return;
        }

        setJobs(data.jobs);
        setProfiles(data.profiles);
        setVendors(data.vendors);
      } catch (error) {
        if (isMounted) {
          console.error("Could not load repairs:", error);
          setErrorMessage("Could not load repairs.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialRepairs();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleStatusChange(job, newStatus) {
    if (!canManageRepairJobs) {
      setStatusErrorMessage("Your role cannot update work orders.");
      return;
    }

    if (!statusOptions.includes(newStatus)) {
      setStatusErrorMessage("That status is not allowed for work orders.");
      return;
    }

    const previousStatus = job.status;

    setStatusErrorMessage("");
    setStatusSuccessMessage("");
    setUpdatingStatusId(job.id);
    setJobs((currentJobs) =>
      currentJobs.map((currentJob) =>
        currentJob.id === job.id ? { ...currentJob, status: newStatus } : currentJob
      )
    );

    try {
      const { error } = await supabase
        .from("repair_jobs")
        .update({
          completed_at:
            newStatus === "completed"
              ? new Date().toISOString()
              : job.completed_at,
          status: newStatus,
        })
        .eq("id", job.id);

      if (error) {
        console.error("Could not update work order status:", error);
        throw error;
      }

      await logVehicleActivity({
        vehicleId: job.vehicle_id,
        action: "Repair job status changed",
        details: {
          from: previousStatus,
          title: job.title,
          to: newStatus,
        },
      });
      setStatusSuccessMessage("Work order status updated.");
    } catch (error) {
      setJobs((currentJobs) =>
        currentJobs.map((currentJob) =>
          currentJob.id === job.id
            ? { ...currentJob, status: previousStatus }
            : currentJob
        )
      );
      console.error("Could not update work order status:", error);
      setStatusErrorMessage("Could not update work order status. Please try again.");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  function toggleDetails(jobId) {
    setExpandedJobIds((currentIds) =>
      currentIds.includes(jobId)
        ? currentIds.filter((currentId) => currentId !== jobId)
        : [...currentIds, jobId]
    );
  }

  function updateJobList(jobId, updater) {
    setJobs((currentJobs) =>
      currentJobs.map((job) => (job.id === jobId ? updater(job) : job))
    );
  }

  async function persistAutomaticJobStatus(job, nextStatus, details = {}) {
    if (!job?.id || !nextStatus || job.status === nextStatus) {
      return;
    }

    const previousStatus = job.status;

    setJobs((currentJobs) =>
      currentJobs.map((currentJob) =>
        currentJob.id === job.id
          ? { ...currentJob, status: nextStatus }
          : currentJob
      )
    );

    const { error } = await supabase
      .from("repair_jobs")
      .update({ status: nextStatus })
      .eq("id", job.id);

    if (error) {
      console.error("Could not update work order status:", error);
      setJobs((currentJobs) =>
        currentJobs.map((currentJob) =>
          currentJob.id === job.id
            ? { ...currentJob, status: previousStatus }
            : currentJob
        )
      );
      setStatusErrorMessage(
        "Work was saved, but work order status could not be updated. Please refresh and try again."
      );
      return;
    }

    await logVehicleActivity({
      vehicleId: job.vehicle_id,
      action: "Work order status changed automatically",
      details: {
        ...details,
        from: previousStatus,
        title: job.title,
        to: nextStatus,
      },
    });
  }

  async function handlePartAdded(partRequest) {
    const job = jobs.find(
      (currentJob) => currentJob.id === partRequest?.repair_job_id
    );

    if (partRequest?.id && partRequest?.repair_job_id) {
      updateJobList(partRequest.repair_job_id, (job) => ({
        ...job,
        parts: [
          partRequest,
          ...job.parts.filter((part) => part.id !== partRequest.id),
        ],
      }));
    }

    await persistAutomaticJobStatus(
      job,
      getWorkOrderStatusAfterPartAdded(job?.status, partRequest),
      {
        part_name: partRequest?.part_name,
        part_source: partRequest?.part_source,
        trigger: "part_added",
      }
    );

    setActivePartJob(null);
  }

  async function handleLaborAdded(laborLog) {
    const job = jobs.find(
      (currentJob) => currentJob.id === laborLog?.repair_job_id
    );

    if (laborLog?.id && laborLog?.repair_job_id) {
      updateJobList(laborLog.repair_job_id, (job) => ({
        ...job,
        laborLogs: [
          laborLog,
          ...job.laborLogs.filter((log) => log.id !== laborLog.id),
        ],
      }));
    }

    await persistAutomaticJobStatus(
      job,
      getWorkOrderStatusAfterWorkStarted(job?.status),
      {
        labor_log_id: laborLog?.id,
        trigger: "labor_added",
      }
    );

    setActiveLaborJob(null);
  }

  function handlePhotoAdded(photo) {
    if (photo?.id && photo?.repair_job_id) {
      updateJobList(photo.repair_job_id, (job) => ({
        ...job,
        photos: [photo, ...job.photos.filter((item) => item.id !== photo.id)],
      }));
    }

    setActivePhotoJob(null);
  }

  function noopActivityRefresh() {
    // Global queue actions log activity; the queue itself has no timeline.
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Repairs</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Track open work orders across all vehicles.
            </p>
          </div>
          <button
            className={buttonClassNames.secondary}
            disabled={isLoading}
            onClick={() => loadRepairsQueue()}
            type="button"
          >
            <AppIcon name="refresh" size={16} />
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="mt-4">
          <label className="relative block" htmlFor="repairs-queue-search">
            <span className="sr-only">Search work orders</span>
            <AppIcon
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              name="search"
              size={18}
            />
            <input
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white py-2 pl-11 pr-4 text-sm font-semibold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              id="repairs-queue-search"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search work order, stock, vehicle, service, part, or vendor"
              type="search"
              value={searchTerm}
            />
          </label>
        </div>

        <div className="mt-4">
          <RepairsQueueTabs
            activeTab={activeTab}
            counts={countsByTab}
            onChange={setActiveTab}
          />
        </div>
      </section>

      {isLoading && (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-slate-700">Loading repairs...</p>
        </section>
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {errorMessage}
        </section>
      )}

      {!isLoading && statusErrorMessage && (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {statusErrorMessage}
        </section>
      )}

      {!isLoading && statusSuccessMessage && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {statusSuccessMessage}
        </section>
      )}

      {!isLoading && !errorMessage && filteredJobs.length === 0 && (
        <RepairJobEmptyState
          activeTab={activeTab}
          hasSearch={Boolean(searchTerm.trim())}
        />
      )}

      {!isLoading && !errorMessage && filteredJobs.length > 0 && (
        <section className="space-y-3">
          {filteredJobs.map((job) => (
            <RepairJobCard
              canManageLabor={canManageLabor}
              canManageParts={canManageWorkOrderParts}
              canManagePhotos={canManagePhotos}
              canManageRepairJobs={canManageRepairJobs}
              isExpanded={expandedJobIds.includes(job.id)}
              isUpdating={updatingStatusId === job.id}
              job={job}
              key={job.id}
              onAddLabor={setActiveLaborJob}
              onAddPart={setActivePartJob}
              onAddPhoto={setActivePhotoJob}
              onOpenVehicle={onSelectVehicle}
              onStatusChange={handleStatusChange}
              onToggleDetails={toggleDetails}
            />
          ))}
        </section>
      )}

      {activePartJob && canManageWorkOrderParts && (
        <AddWorkOrderPartForm
          currentProfile={currentProfile}
          onActivityLogged={noopActivityRefresh}
          onClose={() => setActivePartJob(null)}
          onPartAdded={handlePartAdded}
          vehicle={activePartJob.vehicle}
          vehicleId={activePartJob.vehicle_id}
          vendors={vendors}
          workOrder={activePartJob}
        />
      )}

      {activeLaborJob && canManageLabor && (
        <AddWorkOrderLaborForm
          currentProfile={currentProfile}
          onActivityLogged={noopActivityRefresh}
          onClose={() => setActiveLaborJob(null)}
          onLaborAdded={handleLaborAdded}
          profiles={profiles}
          vehicleId={activeLaborJob.vehicle_id}
          workOrder={activeLaborJob}
        />
      )}

      {activePhotoJob && canManagePhotos && (
        <AddWorkOrderPhotoForm
          onActivityLogged={noopActivityRefresh}
          onClose={() => setActivePhotoJob(null)}
          onPhotoAdded={handlePhotoAdded}
          vehicleId={activePhotoJob.vehicle_id}
          workOrder={activePhotoJob}
        />
      )}
    </div>
  );
}

export default RepairsPage;
