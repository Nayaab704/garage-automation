import { useState } from "react";
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
import { supabase } from "../../lib/supabaseClient";

const emptyForm = {
  repair_job_id: "",
  technician_id: "",
  hours: "",
  hourly_rate: "",
  notes: "",
};

function emptyToNull(value) {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
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
    "Untitled Repair Job"
  );
}

function getTechnicianName(profile) {
  return (
    getFirstValue(profile, ["full_name", "name", "display_name", "email"]) ??
    "Unnamed Technician"
  );
}

function parsePositiveNumber(value, label) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return { error: `${label} must be greater than 0.`, value: null };
  }

  return { error: "", value: numberValue };
}

function parseNonnegativeNumber(value, label) {
  const numberValue = Number(value || 0);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return { error: `${label} must be 0 or greater.`, value: null };
  }

  return { error: "", value: numberValue };
}

function AddLaborLogForm({
  onClose,
  onActivityLogged,
  onLaborLogAdded,
  profiles = [],
  repairJobs = [],
  vehicleId,
}) {
  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
      ...(name === "technician_id"
        ? {
            hourly_rate: String(
              getProfileHourlyRate(
                profiles.find((profile) => profile.id === value)
              )
            ),
          }
        : {}),
    }));
  }

  function validateForm() {
    const hours = parsePositiveNumber(formData.hours, "Hours");
    const hourlyRate = parseNonnegativeNumber(
      formData.hourly_rate,
      "Hourly rate"
    );

    if (!formData.repair_job_id) {
      return { error: "Repair job is required." };
    }

    if (!formData.technician_id) {
      return { error: "Technician is required." };
    }

    if (hours.error) {
      return { error: hours.error };
    }

    if (hourlyRate.error) {
      return { error: hourlyRate.error };
    }

    return {
      error: "",
      values: {
        hourlyRate: hourlyRate.value,
        hours: hours.value,
      },
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const validation = validateForm();

      if (validation.error) {
        setErrorMessage(validation.error);
        return;
      }

      const laborLog = {
        vehicle_id: vehicleId,
        repair_job_id: formData.repair_job_id,
        technician_id: formData.technician_id,
        hours: validation.values.hours,
        hourly_rate: validation.values.hourlyRate,
        labor_cost: calculateLaborCost(
          validation.values.hours,
          validation.values.hourlyRate
        ),
        notes: emptyToNull(formData.notes),
      };

      const { error } = await supabase.from("labor_logs").insert([laborLog]);

      if (error) {
        setErrorMessage(error.message);
      } else {
        setFormData(emptyForm);
        setSuccessMessage("Labor log added successfully.");
        await logVehicleActivity({
          vehicleId,
          action: "Labor log added",
          details: {
            repair_job: getRepairJobTitle(
              repairJobs.find(
                (repairJob) => repairJob.id === laborLog.repair_job_id
              ) ?? {}
            ),
            technician: getTechnicianName(
              profiles.find(
                (profile) => profile.id === laborLog.technician_id
              ) ?? {}
            ),
            hours: laborLog.hours,
            hourly_rate: laborLog.hourly_rate,
            labor_cost: laborLog.labor_cost,
          },
        });
        onActivityLogged?.();
        await onLaborLogAdded();
      }
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="Record technician time for this vehicle."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      title="Add Labor Log"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">
              Labor Cost Preview
            </p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {Number(formData.hours || 0) > 0
                ? `${Number(formData.hours || 0)}h x ${formatHourlyRate(
                    formData.hourly_rate
                  )} = ${formatCurrency(
                    calculateLaborCost(formData.hours, formData.hourly_rate)
                  )}`
                : `${formatHourlyRate(formData.hourly_rate)} rate selected`}
            </p>
            {formData.technician_id &&
              Number(formData.hourly_rate || 0) === 0 &&
              Number(formData.hours || 0) > 0 && (
                <p className="mt-2 text-xs font-semibold text-amber-700">
                  No hourly rate set for this technician. Labor cost will save as $0.00.
                </p>
              )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="labor-repair-job">
              <span className={formControlClassNames.label}>
                Repair Job
              </span>
              <select
                className={formControlClassNames.select}
                id="labor-repair-job"
                name="repair_job_id"
                onChange={handleChange}
                required
                value={formData.repair_job_id}
              >
                <option value="">Select a repair job</option>
                {repairJobs.map((repairJob) => (
                  <option key={repairJob.id} value={repairJob.id}>
                    {getRepairJobTitle(repairJob)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block" htmlFor="labor-technician">
              <span className={formControlClassNames.label}>
                Technician
              </span>
              <select
                className={formControlClassNames.select}
                id="labor-technician"
                name="technician_id"
                onChange={handleChange}
                required
                value={formData.technician_id}
              >
                <option value="">Select a technician</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {getTechnicianName(profile)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="labor-hours">
              <span className={formControlClassNames.label}>Hours</span>
              <input
                className={formControlClassNames.input}
                id="labor-hours"
                min="0.25"
                name="hours"
                onChange={handleChange}
                required
                step="0.25"
                type="number"
                value={formData.hours}
              />
            </label>

            <label className="block" htmlFor="labor-hourly-rate">
              <span className={formControlClassNames.label}>
                Hourly Rate
              </span>
              <input
                className={formControlClassNames.input}
                disabled
                id="labor-hourly-rate"
                min="0"
                name="hourly_rate"
                required
                step="0.01"
                type="number"
                value={formData.hourly_rate}
              />
            </label>
          </div>

          <label className="block" htmlFor="labor-notes">
            <span className={formControlClassNames.label}>Notes</span>
            <textarea
              className={formControlClassNames.textarea}
              id="labor-notes"
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
            submitLabel="Add Labor Log"
            submittingLabel="Adding..."
          />
        </form>
    </ModalShell>
  );
}

export default AddLaborLogForm;
