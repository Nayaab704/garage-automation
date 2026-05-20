import { useState } from "react";
import AddRepairJobForm from "./AddRepairJobForm";
import StatusDropdown from "./StatusDropdown";
import { formatRepairProcessType } from "../../lib/repairProcess";
import { supabase } from "../../lib/supabaseClient";

const repairJobStatuses = [
  "needed",
  "approved",
  "in_progress",
  "waiting_parts",
  "blocked",
  "completed",
  "cancelled",
];

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function getFirstValue(record, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = record[fieldName];

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

function getNestedName(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value.name ?? value.full_name ?? value.display_name ?? null;
}

function getTechnicianName(repairJob) {
  const directName = getFirstValue(repairJob, [
    "assigned_technician_name",
    "technician_name",
    "assigned_to_name",
  ]);

  if (directName) {
    return directName;
  }

  return (
    getNestedName(repairJob.technician) ??
    getNestedName(repairJob.assigned_technician) ??
    getNestedName(repairJob.assigned_to)
  );
}

function getRepairProcessById(repairProcesses, repairProcessId) {
  return repairProcesses.find(
    (repairProcess) => repairProcess.id === repairProcessId
  );
}

function getRepairProcessLabel(repairProcesses, repairProcessId) {
  const repairProcess = getRepairProcessById(repairProcesses, repairProcessId);

  if (!repairProcess) {
    return "Not available";
  }

  return formatRepairProcessType(repairProcess.process_type);
}

function priorityClassName(priority) {
  const normalizedPriority = String(priority ?? "").toLowerCase();

  if (normalizedPriority === "high" || normalizedPriority === "urgent") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (normalizedPriority === "medium") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function Badge({ className, children }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}

function RepairJobCard({
  onStatusChange,
  repairJob,
  repairProcesses,
  updatingStatusId,
}) {
  const title =
    getFirstValue(repairJob, ["title", "name", "job_title", "repair_title"]) ??
    "Repair Job";
  const category = getFirstValue(repairJob, ["category", "repair_category"]);
  const priority = getFirstValue(repairJob, ["priority"]);
  const status = getFirstValue(repairJob, ["status"]);
  const notes = getFirstValue(repairJob, ["notes", "description"]);
  const technicianName = getTechnicianName(repairJob);

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-950">{title}</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {displayValue(category)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className={priorityClassName(priority)}>
            {displayValue(priority)}
          </Badge>
          <StatusDropdown
            currentStatus={status}
            isUpdating={updatingStatusId === repairJob.id}
            onChange={(newStatus) => onStatusChange(repairJob.id, newStatus)}
            statuses={repairJobStatuses}
          />
        </div>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <DetailItem
          label="Assigned Technician"
          value={displayValue(technicianName)}
        />
        <DetailItem
          label="Category"
          value={displayValue(category)}
        />
        <DetailItem
          label="Repair Process"
          value={getRepairProcessLabel(
            repairProcesses,
            repairJob.repair_process_id
          )}
        />
      </dl>

      {notes && (
        <div className="mt-5 rounded-md bg-zinc-50 p-4">
          <p className="text-sm font-medium text-zinc-500">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {notes}
          </p>
        </div>
      )}
    </article>
  );
}

function RepairJobsSection({
  onRepairJobAdded,
  onRepairJobStatusUpdated,
  repairProcesses = [],
  repairJobs = [],
  vehicleId,
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  async function handleStatusChange(repairJobId, newStatus) {
    if (!repairJobId) {
      setStatusError("Unable to update a repair job without an ID.");
      return;
    }

    const currentRepairJob = repairJobs.find(
      (repairJob) => repairJob.id === repairJobId
    );
    const previousStatus = currentRepairJob
      ? getFirstValue(currentRepairJob, ["status"])
      : null;

    setStatusError("");
    setUpdatingStatusId(repairJobId);
    onRepairJobStatusUpdated(repairJobId, newStatus);

    try {
      const { error } = await supabase
        .from("repair_jobs")
        .update({ status: newStatus })
        .eq("id", repairJobId);

      if (error) {
        onRepairJobStatusUpdated(repairJobId, previousStatus);
        setStatusError(error.message);
        return;
      }
    } catch (error) {
      onRepairJobStatusUpdated(repairJobId, previousStatus);
      setStatusError(error.message ?? "Something went wrong.");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">Repair Jobs</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {repairJobs.length}{" "}
            {repairJobs.length === 1 ? "record" : "records"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">
            {repairJobs.length}
          </span>
          <button
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            onClick={() => setIsFormOpen(true)}
            type="button"
          >
            Add Repair Job
          </button>
        </div>
      </div>

      {repairJobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          No repair jobs found for this vehicle.
        </div>
      ) : (
        <div className="space-y-3">
          {repairJobs.map((repairJob, index) => (
            <RepairJobCard
              key={repairJob.id ?? index}
              onStatusChange={handleStatusChange}
              repairJob={repairJob}
              repairProcesses={repairProcesses}
              updatingStatusId={updatingStatusId}
            />
          ))}
        </div>
      )}

      {statusError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {statusError}
        </div>
      )}

      {isFormOpen && (
        <AddRepairJobForm
          onClose={() => setIsFormOpen(false)}
          onRepairJobAdded={onRepairJobAdded}
          repairProcesses={repairProcesses}
          vehicleId={vehicleId}
        />
      )}
    </section>
  );
}

export default RepairJobsSection;
