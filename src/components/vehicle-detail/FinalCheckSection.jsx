import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import {
  areFinalChecksComplete,
  finalCheckTemplates,
} from "../../lib/finalChecks";
import { supabase } from "../../lib/supabaseClient";

function formatDateTime(value) {
  if (!value) {
    return "Not checked";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not checked";
  }

  return date.toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getProfileName(profiles, profileId) {
  const profile = profiles.find((profileRecord) => profileRecord.id === profileId);
  return profile?.full_name || profile?.email || "Unknown User";
}

function canUpdateCheck(currentProfile, finalCheck) {
  const role = currentProfile?.role;

  if (role === "owner" || role === "admin") {
    return true;
  }

  return role === "technician" && finalCheck.required_role === "technician";
}

function getCheckByTemplate(finalChecks, template) {
  return (
    finalChecks.find((finalCheck) => finalCheck.check_key === template.check_key) ??
    {
      ...template,
      id: null,
      is_checked: false,
      checked_by: null,
      checked_at: null,
      notes: "",
    }
  );
}

function CheckRow({
  currentProfile,
  finalCheck,
  onToggle,
  profiles,
  updatingCheckId,
}) {
  const isAllowed = canUpdateCheck(currentProfile, finalCheck);
  const isUpdating = updatingCheckId === finalCheck.id;

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <label className="flex items-start gap-3">
          <input
            checked={Boolean(finalCheck.is_checked)}
            className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!isAllowed || isUpdating || !finalCheck.id}
            onChange={(event) => onToggle(finalCheck, event.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="block font-semibold text-zinc-950">
              {finalCheck.label}
            </span>
            <span className="mt-1 block text-sm text-zinc-500">
              {finalCheck.is_checked ? "Complete" : "Not complete"}
            </span>
          </span>
        </label>

        <span
          className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
            finalCheck.is_checked
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-zinc-100 text-zinc-700 ring-zinc-200"
          }`}
        >
          {finalCheck.is_checked ? "Checked" : "Open"}
        </span>
      </div>

      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-zinc-500">Checked By</p>
          <p className="mt-1 font-medium text-zinc-800">
            {finalCheck.checked_by
              ? getProfileName(profiles, finalCheck.checked_by)
              : "Not checked"}
          </p>
        </div>
        <div>
          <p className="text-zinc-500">Checked At</p>
          <p className="mt-1 font-medium text-zinc-800">
            {formatDateTime(finalCheck.checked_at)}
          </p>
        </div>
      </div>

      {finalCheck.notes && (
        <p className="mt-3 whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
          {finalCheck.notes}
        </p>
      )}
    </div>
  );
}

function FinalCheckGroup({
  currentProfile,
  finalChecks,
  onToggle,
  profiles,
  requiredRole,
  title,
  updatingCheckId,
}) {
  const templates = finalCheckTemplates.filter(
    (template) => template.required_role === requiredRole
  );

  return (
    <div>
      <h3 className="text-base font-bold text-zinc-950">{title}</h3>
      <div className="mt-3 space-y-3">
        {templates.map((template) => (
          <CheckRow
            currentProfile={currentProfile}
            finalCheck={getCheckByTemplate(finalChecks, template)}
            key={template.check_key}
            onToggle={onToggle}
            profiles={profiles}
            updatingCheckId={updatingCheckId}
          />
        ))}
      </div>
    </div>
  );
}

function FinalCheckSection({
  currentProfile,
  finalChecks = [],
  onActivityLogged,
  onFinalCheckUpdated,
  profiles = [],
  vehicleId,
}) {
  const [errorMessage, setErrorMessage] = useState("");
  const [updatingCheckId, setUpdatingCheckId] = useState(null);
  const checksByKey = new Map(
    finalChecks.map((finalCheck) => [finalCheck.check_key, finalCheck])
  );
  const completedCount = finalCheckTemplates.filter(
    (template) => checksByKey.get(template.check_key)?.is_checked === true
  ).length;
  const allChecksComplete = areFinalChecksComplete(finalChecks);

  async function handleToggle(finalCheck, isChecked) {
    if (!canUpdateCheck(currentProfile, finalCheck)) {
      setErrorMessage("Your role cannot update this final check.");
      return;
    }

    if (!finalCheck.id) {
      setErrorMessage("This final check is still being prepared. Refresh and try again.");
      return;
    }

    const wasComplete = areFinalChecksComplete(finalChecks);

    setUpdatingCheckId(finalCheck.id);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("vehicle_final_checks")
        .update({
          checked_at: isChecked ? new Date().toISOString() : null,
          checked_by: isChecked ? currentProfile?.id ?? null : null,
          is_checked: isChecked,
        })
        .eq("id", finalCheck.id)
        .select(
          "id, vehicle_id, check_key, label, required_role, is_checked, checked_by, checked_at, notes, created_at"
        )
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      onFinalCheckUpdated?.(data);
      await logVehicleActivity({
        vehicleId,
        action: isChecked ? "Final check completed" : "Final check unchecked",
        details: {
          check_key: finalCheck.check_key,
          label: finalCheck.label,
        },
      });

      const nextChecks = finalChecks.map((check) =>
        check.id === data.id ? data : check
      );

      if (!wasComplete && areFinalChecksComplete(nextChecks)) {
        await logVehicleActivity({
          vehicleId,
          action: "Vehicle cleared for Ready For Sale",
          details: {
            completed_checks: finalCheckTemplates.length,
          },
        });
      }

      onActivityLogged?.();
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setUpdatingCheckId(null);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">Final Check</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {completedCount} / {finalCheckTemplates.length} checks complete
          </p>
        </div>

        <span
          className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${
            allChecksComplete
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-amber-50 text-amber-800 ring-amber-200"
          }`}
        >
          {allChecksComplete ? "Cleared" : "Needs Review"}
        </span>
      </div>

      {allChecksComplete && (
        <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          Vehicle is cleared to be marked Ready For Sale.
        </div>
      )}

      {errorMessage && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <FinalCheckGroup
          currentProfile={currentProfile}
          finalChecks={finalChecks}
          onToggle={handleToggle}
          profiles={profiles}
          requiredRole="technician"
          title="Technician Checklist"
          updatingCheckId={updatingCheckId}
        />
        <FinalCheckGroup
          currentProfile={currentProfile}
          finalChecks={finalChecks}
          onToggle={handleToggle}
          profiles={profiles}
          requiredRole="admin"
          title="Admin Checklist"
          updatingCheckId={updatingCheckId}
        />
      </div>
    </section>
  );
}

export default FinalCheckSection;
