import { useEffect, useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { formControlClassNames } from "../ui/uiStyles";
import { logVehicleActivity } from "../../lib/activityLogger";
import {
  calculateLaborCost,
  formatCurrency,
  formatHourlyRate,
  getProfileHourlyRate,
} from "../../lib/laborCost";
import {
  fetchSelectableLaborProfileById,
  fetchSelectableLaborProfiles,
  formatLaborProfileName,
  isLaborProfileSelectable,
  NO_ACTIVE_TEAM_MEMBERS_MESSAGE,
} from "../../lib/laborProfiles";
import { isAdminOrManagerRole } from "../../lib/permissions";
import { supabase } from "../../lib/supabaseClient";

const emptyForm = {
  technician_id: "",
  hours: "",
  notes: "",
};

function emptyToNull(value) {
  const trimmedValue = String(value ?? "").trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function getWorkOrderTitle(workOrder) {
  return workOrder?.title || workOrder?.name || "Work Order";
}

function AddWorkOrderLaborForm({
  currentProfile,
  onActivityLogged,
  onClose,
  onLaborAdded,
  vehicleId,
  workOrder,
}) {
  const canPickTechnician = isAdminOrManagerRole(currentProfile?.role);
  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(canPickTechnician);
  const [errorMessage, setErrorMessage] = useState("");
  const [profileLoadError, setProfileLoadError] = useState("");
  const [selectableProfiles, setSelectableProfiles] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const selectedTechnician = getSelectedTechnician();
  const previewHours = Number(formData.hours || 0);
  const selectedHourlyRate = getProfileHourlyRate(selectedTechnician);
  const previewLaborCost = calculateLaborCost(previewHours, selectedHourlyRate);
  const shouldShowRateWarning =
    Boolean(selectedTechnician?.id) &&
    selectedHourlyRate === 0 &&
    Number.isFinite(previewHours) &&
    previewHours > 0;

  useEffect(() => {
    if (!canPickTechnician) {
      return undefined;
    }

    let isCurrent = true;

    fetchSelectableLaborProfiles(supabase)
      .then((profiles) => {
        if (isCurrent) {
          setSelectableProfiles(profiles);
        }
      })
      .catch((error) => {
        console.error("Could not load active team members:", error);

        if (isCurrent) {
          setSelectableProfiles([]);
          setProfileLoadError("Could not load active team members.");
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingProfiles(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [canPickTechnician]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function getSelectedTechnician() {
    if (canPickTechnician && formData.technician_id) {
      return selectableProfiles.find(
        (profile) => profile.id === formData.technician_id
      );
    }

    return isLaborProfileSelectable(currentProfile) ? currentProfile : null;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const hours = Number(formData.hours || 0);
    if (!vehicleId || !workOrder?.id) {
      setErrorMessage("Unable to add labor without a work order.");
      return;
    }

    if (!selectedTechnician?.id) {
      setErrorMessage("Select an active team member before adding labor.");
      return;
    }

    if (!Number.isFinite(hours) || hours <= 0) {
      setErrorMessage("Hours must be greater than 0.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const verifiedTechnician = await fetchSelectableLaborProfileById(
        supabase,
        selectedTechnician.id
      );

      if (!verifiedTechnician) {
        setErrorMessage(
          "This team member is inactive or has been removed. Select an active team member."
        );
        return;
      }

      const hourlyRate = getProfileHourlyRate(verifiedTechnician);

      if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
        setErrorMessage("Hourly rate must be 0 or greater.");
        return;
      }

      const laborCost = calculateLaborCost(hours, hourlyRate);
      const laborLog = {
        vehicle_id: vehicleId,
        repair_job_id: workOrder.id,
        technician_id: verifiedTechnician.id,
        hours,
        hourly_rate: hourlyRate,
        labor_cost: laborCost,
        notes: emptyToNull(formData.notes),
      };

      const { data, error } = await supabase
        .from("labor_logs")
        .insert([laborLog])
        .select("*")
        .single();

      if (error) {
        console.error("Could not save labor:", error);
        setErrorMessage("Could not save labor.");
        return;
      }

      setFormData(emptyForm);
      setSuccessMessage("Labor added successfully.");
      await logVehicleActivity({
        vehicleId,
        action: "Labor log added",
        details: {
          repair_job: getWorkOrderTitle(workOrder),
          technician: formatLaborProfileName(verifiedTechnician),
          hours: laborLog.hours,
          hourly_rate: laborLog.hourly_rate,
          labor_cost: laborLog.labor_cost,
        },
      });
      onActivityLogged?.();
      await onLaborAdded?.(data ?? laborLog);
    } catch (error) {
      console.error("Could not save labor:", error);
      setErrorMessage("Could not save labor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="Record time for this work order."
      eyebrow={getWorkOrderTitle(workOrder)}
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      title="Add Labor"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          {canPickTechnician && (
            <label className="block" htmlFor="work-order-labor-technician">
              <span className={formControlClassNames.label}>Technician</span>
              <select
                className={formControlClassNames.select}
                disabled={isLoadingProfiles || selectableProfiles.length === 0}
                id="work-order-labor-technician"
                name="technician_id"
                onChange={handleChange}
                value={formData.technician_id}
              >
                <option value="">
                  {isLoadingProfiles
                    ? "Loading active team members..."
                    : isLaborProfileSelectable(currentProfile)
                      ? `Use my profile (${formatLaborProfileName(currentProfile)})`
                      : "Select a team member"}
                </option>
                {selectableProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {formatLaborProfileName(profile)}
                  </option>
                ))}
              </select>
              {!isLoadingProfiles &&
                !profileLoadError &&
                selectableProfiles.length === 0 && (
                  <span className="mt-2 block text-sm font-semibold text-amber-700">
                    {NO_ACTIVE_TEAM_MEMBERS_MESSAGE}
                  </span>
                )}
              {profileLoadError && (
                <span className="mt-2 block text-sm font-semibold text-red-700">
                  {profileLoadError}
                </span>
              )}
            </label>
          )}

          <label className="block" htmlFor="work-order-labor-hours">
            <span className={formControlClassNames.label}>Hours</span>
            <input
              className={formControlClassNames.input}
              id="work-order-labor-hours"
              min="0.25"
              name="hours"
              onChange={handleChange}
              required
              step="0.25"
              type="number"
              value={formData.hours}
            />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">
              Labor Cost Preview
            </p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {Number.isFinite(previewHours) && previewHours > 0
                ? `${previewHours}h x ${formatHourlyRate(
                    selectedHourlyRate
                  )} = ${formatCurrency(previewLaborCost)}`
                : `${formatHourlyRate(selectedHourlyRate)} rate selected`}
            </p>
            {shouldShowRateWarning && (
              <p className="mt-2 text-xs font-semibold text-amber-700">
                No hourly rate set for this technician. Labor cost will save as $0.00.
              </p>
            )}
          </div>

          <label className="block" htmlFor="work-order-labor-notes">
            <span className={formControlClassNames.label}>Notes</span>
            <textarea
              className={formControlClassNames.textarea}
              id="work-order-labor-notes"
              name="notes"
              onChange={handleChange}
              value={formData.notes}
            />
          </label>

          <FormMessage tone="error">{errorMessage}</FormMessage>

          <FormMessage tone="success">{successMessage}</FormMessage>

          <FormActions
            isSubmitting={isSubmitting}
            onCancel={onClose}
            submitLabel="Add Labor"
            submittingLabel="Adding labor..."
          />
        </form>
    </ModalShell>
  );
}

export default AddWorkOrderLaborForm;
