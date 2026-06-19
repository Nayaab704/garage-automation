import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import {
  areFinalChecksComplete,
  finalCheckTemplates,
} from "../../lib/finalChecks";
import VehicleDetailSection from "./VehicleDetailSection";
import { supabase } from "../../lib/supabaseClient";

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getReadinessLabel({
  adminCompletedCount,
  adminTotal,
  allChecksComplete,
  technicianCompletedCount,
  technicianTotal,
}) {
  if (allChecksComplete) {
    return "Ready For Sale";
  }

  if (
    technicianCompletedCount === technicianTotal &&
    adminCompletedCount < adminTotal
  ) {
    return "Ready for Admin Review";
  }

  return "Not Ready";
}

function getProfileName(profiles, profileId) {
  const profile = profiles.find(
    (profileRecord) => profileRecord.id === profileId
  );
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
  const checkedBy = finalCheck.checked_by
    ? getProfileName(profiles, finalCheck.checked_by)
    : "";
  const checkedAt = formatDateTime(finalCheck.checked_at);
  const checkedMeta = finalCheck.is_checked
    ? ["Checked", checkedBy, checkedAt].filter(Boolean).join(" - ")
    : "";

  return (
    <label
      className={`grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
        finalCheck.is_checked
          ? "border-emerald-200 bg-emerald-50/30"
          : "border-slate-200 bg-white"
      } ${
        isAllowed && finalCheck.id
          ? "cursor-pointer hover:border-blue-200 hover:bg-blue-50/40"
          : "cursor-default"
      }`}
    >
      <input
        checked={Boolean(finalCheck.is_checked)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!isAllowed || isUpdating || !finalCheck.id}
        onChange={(event) => onToggle(finalCheck, event.target.checked)}
        type="checkbox"
      />

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-950">
          {finalCheck.label}
        </span>
        {checkedMeta ? (
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {checkedMeta}
          </span>
        ) : finalCheck.notes ? (
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {finalCheck.notes}
          </span>
        ) : null}
      </span>

      <span
        className={`mt-0.5 w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
          finalCheck.is_checked
            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
            : "bg-slate-100 text-slate-700 ring-slate-200"
        }`}
      >
        {finalCheck.is_checked ? "Checked" : "Pending"}
      </span>
    </label>
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
  const completedCount = templates.filter(
    (template) =>
      getCheckByTemplate(finalChecks, template).is_checked === true
  ).length;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <h3 className="text-sm font-black text-slate-950">{title}</h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
          {completedCount}/{templates.length}
        </span>
      </div>
      <div className="space-y-2">
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
    </section>
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
  const progressPercent = Math.round(
    (completedCount / finalCheckTemplates.length) * 100
  );
  const allChecksComplete = areFinalChecksComplete(finalChecks);
  const technicianTemplates = finalCheckTemplates.filter(
    (template) => template.required_role === "technician"
  );
  const adminTemplates = finalCheckTemplates.filter(
    (template) => template.required_role === "admin"
  );
  const technicianCompletedCount = technicianTemplates.filter(
    (template) => checksByKey.get(template.check_key)?.is_checked === true
  ).length;
  const adminCompletedCount = adminTemplates.filter(
    (template) => checksByKey.get(template.check_key)?.is_checked === true
  ).length;
  const readinessLabel = getReadinessLabel({
    adminCompletedCount,
    adminTotal: adminTemplates.length,
    allChecksComplete,
    technicianCompletedCount,
    technicianTotal: technicianTemplates.length,
  });
  const progressLabel = `${completedCount}/${finalCheckTemplates.length} checked`;

  async function handleToggle(finalCheck, isChecked) {
    if (!canUpdateCheck(currentProfile, finalCheck)) {
      setErrorMessage("Your role cannot update this final check.");
      return;
    }

    if (!finalCheck.id) {
      setErrorMessage(
        "This final check is still being prepared. Refresh and try again."
      );
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
    <VehicleDetailSection
      badge={readinessLabel}
      icon="checklist"
      summary={progressLabel}
      title="Final Checklist"
      tone={allChecksComplete ? "emerald" : "amber"}
    >
      <div className="space-y-4">
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all ${
                allChecksComplete ? "bg-emerald-600" : "bg-amber-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
            <span>
              Technician {technicianCompletedCount}/{technicianTemplates.length}
            </span>
            <span>Admin {adminCompletedCount}/{adminTemplates.length}</span>
          </div>
        </div>

        {allChecksComplete && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            Vehicle is cleared to be marked Ready For Sale.
          </div>
        )}

        {errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
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
      </div>
    </VehicleDetailSection>
  );
}

export default FinalCheckSection;
