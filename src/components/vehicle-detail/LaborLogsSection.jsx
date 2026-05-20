import { useState } from "react";
import AddLaborLogForm from "./AddLaborLogForm";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US");

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "Not available";
  }

  return currencyFormatter.format(numberValue);
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "Not available";
  }

  return numberFormatter.format(numberValue);
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

function getRepairJobTitle(repairJob) {
  return (
    getFirstValue(repairJob, ["title", "name", "job_title", "repair_title"]) ??
    "Repair Job"
  );
}

function getTechnicianName(profile) {
  return (
    getFirstValue(profile, ["full_name", "name", "display_name", "email"]) ??
    "Technician"
  );
}

function getLaborCost(laborLog) {
  const hours = Number(laborLog.hours);
  const hourlyRate = Number(laborLog.hourly_rate);

  if (!Number.isFinite(hours) || !Number.isFinite(hourlyRate)) {
    return null;
  }

  return hours * hourlyRate;
}

function getRecordById(records, id) {
  return records.find((record) => record.id === id);
}

function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}

function LaborLogCard({
  canManage,
  isDeleting,
  laborLog,
  onDelete,
  profiles,
  repairJobs,
}) {
  const repairJob = getRecordById(repairJobs, laborLog.repair_job_id);
  const technician = getRecordById(profiles, laborLog.technician_id);
  const notes = getFirstValue(laborLog, ["notes", "description"]);
  const laborCost = getLaborCost(laborLog);

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-950">
            {technician ? getTechnicianName(technician) : "Unknown Technician"}
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            {repairJob ? getRepairJobTitle(repairJob) : "Repair job unavailable"}
          </p>
        </div>

        <div className="flex items-start gap-2 sm:flex-col sm:items-end">
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-right text-sm font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
            {formatCurrency(laborCost)}
          </div>
          {canManage && (
            <button
              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isDeleting}
              onClick={() => onDelete(laborLog.id)}
              type="button"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <DetailItem label="Hours" value={formatNumber(laborLog.hours)} />
        <DetailItem
          label="Hourly Rate"
          value={formatCurrency(laborLog.hourly_rate)}
        />
        <DetailItem label="Labor Cost" value={formatCurrency(laborCost)} />
      </dl>

      {notes && (
        <div className="mt-5 rounded-md bg-zinc-50 p-4">
          <p className="text-sm font-medium text-zinc-500">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {displayValue(notes)}
          </p>
        </div>
      )}
    </article>
  );
}

function LaborLogsSection({
  canManage = false,
  laborLogs = [],
  onActivityLogged,
  onLaborLogAdded,
  profiles = [],
  repairJobs = [],
  vehicleId,
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletingLaborLogId, setDeletingLaborLogId] = useState(null);

  async function handleDelete(laborLogId) {
    if (!canManage) {
      setDeleteError("Your role cannot delete labor logs.");
      return;
    }

    if (!laborLogId) {
      setDeleteError("Unable to delete a labor log without an ID.");
      return;
    }

    const confirmed = window.confirm(
      "Delete this labor log? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setDeleteError("");
    setDeletingLaborLogId(laborLogId);

    try {
      const laborLog = laborLogs.find((record) => record.id === laborLogId);
      const repairJob = getRecordById(repairJobs, laborLog?.repair_job_id);
      const technician = getRecordById(profiles, laborLog?.technician_id);
      const { error } = await supabase
        .from("labor_logs")
        .delete()
        .eq("id", laborLogId);

      if (error) {
        setDeleteError(error.message);
        return;
      }

      await logVehicleActivity({
        vehicleId,
        action: "Labor log deleted",
        details: {
          repair_job: repairJob ? getRepairJobTitle(repairJob) : null,
          technician: technician ? getTechnicianName(technician) : null,
          hours: laborLog?.hours,
          hourly_rate: laborLog?.hourly_rate,
        },
      });
      onActivityLogged?.();
      await onLaborLogAdded();
    } catch (error) {
      setDeleteError(error.message ?? "Something went wrong.");
    } finally {
      setDeletingLaborLogId(null);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">Labor Logs</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {laborLogs.length} {laborLogs.length === 1 ? "record" : "records"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">
            {laborLogs.length}
          </span>
          {canManage && (
            <button
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
              onClick={() => setIsFormOpen(true)}
              type="button"
            >
              Add Labor Log
            </button>
          )}
        </div>
      </div>

      {laborLogs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          No labor logs found for this vehicle.
        </div>
      ) : (
        <div className="space-y-3">
          {laborLogs.map((laborLog, index) => (
            <LaborLogCard
              canManage={canManage}
              isDeleting={deletingLaborLogId === laborLog.id}
              key={laborLog.id ?? index}
              laborLog={laborLog}
              onDelete={handleDelete}
              profiles={profiles}
              repairJobs={repairJobs}
            />
          ))}
        </div>
      )}

      {deleteError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {deleteError}
        </div>
      )}

      {isFormOpen && canManage && (
        <AddLaborLogForm
          onClose={() => setIsFormOpen(false)}
          onActivityLogged={onActivityLogged}
          onLaborLogAdded={onLaborLogAdded}
          profiles={profiles}
          repairJobs={repairJobs}
          vehicleId={vehicleId}
        />
      )}
    </section>
  );
}

export default LaborLogsSection;
