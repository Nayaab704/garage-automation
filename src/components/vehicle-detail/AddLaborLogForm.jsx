import { useState } from "react";
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

function AddLaborLogForm({
  onClose,
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
    }));
  }

  function validateForm() {
    const hours = parsePositiveNumber(formData.hours, "Hours");
    const hourlyRate = parsePositiveNumber(formData.hourly_rate, "Hourly rate");

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
        notes: emptyToNull(formData.notes),
      };

      const { error } = await supabase.from("labor_logs").insert([laborLog]);

      if (error) {
        setErrorMessage(error.message);
      } else {
        setFormData(emptyForm);
        setSuccessMessage("Labor log added successfully.");
        await onLaborLogAdded();
      }
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6">
      <div className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-950">
              Add Labor Log
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Record technician time for this vehicle.
            </p>
          </div>

          <button
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="labor-repair-job">
              <span className="text-sm font-medium text-zinc-700">
                Repair Job
              </span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
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
              <span className="text-sm font-medium text-zinc-700">
                Technician
              </span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
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
              <span className="text-sm font-medium text-zinc-700">Hours</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
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
              <span className="text-sm font-medium text-zinc-700">
                Hourly Rate
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="labor-hourly-rate"
                min="0.01"
                name="hourly_rate"
                onChange={handleChange}
                required
                step="0.01"
                type="number"
                value={formData.hourly_rate}
              />
            </label>
          </div>

          <label className="block" htmlFor="labor-notes">
            <span className="text-sm font-medium text-zinc-700">Notes</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="labor-notes"
              name="notes"
              onChange={handleChange}
              value={formData.notes}
            />
          </label>

          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {successMessage}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>

            <button
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Adding..." : "Add Labor Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddLaborLogForm;
