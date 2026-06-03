import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US");

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatCurrency(value) {
  const numberValue = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(numberValue) ? numberValue : 0);
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

function formatNumber(value) {
  const numberValue = Number(value ?? 0);

  if (!Number.isFinite(numberValue)) {
    return "Not available";
  }

  return numberFormatter.format(numberValue);
}

function getProfileName(profiles, profileId) {
  const profile = profiles.find((profileRecord) => profileRecord.id === profileId);
  return profile?.full_name || profile?.email || "Unknown Technician";
}

function isAdminRole(role) {
  return role === "admin" || role === "owner";
}

function getLaborCost(laborLog) {
  const hours = Number(laborLog.hours || 0);
  const hourlyRate = Number(laborLog.hourly_rate || 0);

  if (!Number.isFinite(hours) || !Number.isFinite(hourlyRate)) {
    return 0;
  }

  return hours * hourlyRate;
}

function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}

function WorkOrderLaborList({
  canManage = false,
  currentProfile,
  laborLogs = [],
  onActivityLogged,
  onLaborDeleted,
  profiles = [],
  vehicleId,
}) {
  const [deletingLaborId, setDeletingLaborId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const canViewRates = isAdminRole(currentProfile?.role);

  async function handleDelete(laborLog) {
    if (!canManage) {
      setErrorMessage("Your role cannot delete labor logs.");
      return;
    }

    const confirmed = window.confirm(
      "Delete this labor log? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setDeletingLaborId(laborLog.id);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("labor_logs")
        .delete()
        .eq("id", laborLog.id);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      await logVehicleActivity({
        vehicleId,
        action: "Labor log deleted",
        details: {
          technician: getProfileName(profiles, laborLog.technician_id),
          hours: laborLog.hours,
          hourly_rate: laborLog.hourly_rate,
        },
      });
      onActivityLogged?.();
      await onLaborDeleted?.(laborLog);
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setDeletingLaborId(null);
    }
  }

  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-sm font-bold text-zinc-950">Labor</h5>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200">
          {laborLogs.length} {laborLogs.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {laborLogs.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
          No labor recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {laborLogs.map((laborLog, index) => (
            <article
              className="rounded-md border border-zinc-200 bg-white p-4"
              key={laborLog.id ?? index}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h6 className="font-semibold text-zinc-950">
                    {getProfileName(profiles, laborLog.technician_id)}
                  </h6>
                  <p className="mt-1 text-sm text-zinc-500">
                    {formatNumber(laborLog.hours)} hours on{" "}
                    {formatDate(laborLog.created_at)}
                  </p>
                </div>

                {canManage && (
                  <button
                    className="w-fit rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={deletingLaborId === laborLog.id}
                    onClick={() => handleDelete(laborLog)}
                    type="button"
                  >
                    {deletingLaborId === laborLog.id ? "Deleting..." : "Delete"}
                  </button>
                )}
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <DetailItem label="Hours" value={formatNumber(laborLog.hours)} />
                {canViewRates && (
                  <DetailItem
                    label="Hourly Rate"
                    value={formatCurrency(laborLog.hourly_rate)}
                  />
                )}
                <DetailItem
                  label="Labor Cost"
                  value={formatCurrency(getLaborCost(laborLog))}
                />
              </dl>

              {laborLog.notes && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                  {displayValue(laborLog.notes)}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

export default WorkOrderLaborList;
