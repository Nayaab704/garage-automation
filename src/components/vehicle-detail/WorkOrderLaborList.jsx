import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import {
  formatCurrency,
  getLaborLogCost,
} from "../../lib/laborCost";
import { supabase } from "../../lib/supabaseClient";

const numberFormatter = new Intl.NumberFormat("en-US");

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
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
  return profile?.full_name || profile?.email || "Removed user";
}

function isAdminRole(role) {
  return role === "admin" || role === "owner";
}

function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-zinc-950">
        {value}
      </dd>
    </div>
  );
}

function WorkOrderLaborList({
  canManage = false,
  currentProfile,
  hideHeader = false,
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
          labor_cost: getLaborLogCost(laborLog),
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
    <div className="rounded-md bg-zinc-50 p-3">
      {!hideHeader && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-sm font-bold text-zinc-950">Labor</h5>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200">
            {laborLogs.length} {laborLogs.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      )}

      {laborLogs.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-200 bg-white p-3 text-sm text-zinc-500">
          No labor recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {laborLogs.map((laborLog, index) => {
            const canViewLaborCost =
              canViewRates || laborLog.technician_id === currentProfile?.id;

            return (
              <article
                className="rounded-md border border-zinc-100 bg-white p-3"
                key={laborLog.id ?? index}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h6 className="font-semibold text-zinc-950">
                      {getProfileName(profiles, laborLog.technician_id)}
                    </h6>
                    <p className="mt-1 text-sm tabular-nums text-zinc-500">
                      {formatNumber(laborLog.hours)} hours on{" "}
                      {formatDate(laborLog.created_at)}
                    </p>
                  </div>

                  {canManage && (
                    <button
                      className="min-h-9 w-fit rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                  {canViewLaborCost && (
                    <DetailItem
                      label="Labor Cost"
                      value={formatCurrency(getLaborLogCost(laborLog))}
                    />
                  )}
                </dl>

                {laborLog.notes && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                    {displayValue(laborLog.notes)}
                  </p>
                )}
              </article>
            );
          })}
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
