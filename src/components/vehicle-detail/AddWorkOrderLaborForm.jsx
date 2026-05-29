import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
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

function getTechnicianName(profile) {
  return profile?.full_name || profile?.email || "Technician";
}

function getWorkOrderTitle(workOrder) {
  return workOrder?.title || workOrder?.name || "Work Order";
}

function isAdminRole(role) {
  return role === "admin" || role === "owner";
}

function AddWorkOrderLaborForm({
  currentProfile,
  onActivityLogged,
  onClose,
  onLaborAdded,
  profiles = [],
  vehicleId,
  workOrder,
}) {
  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const canPickTechnician = isAdminRole(currentProfile?.role);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function getSelectedTechnician() {
    if (canPickTechnician && formData.technician_id) {
      return profiles.find((profile) => profile.id === formData.technician_id);
    }

    return currentProfile;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const selectedTechnician = getSelectedTechnician();
    const hours = Number(formData.hours || 0);
    const hourlyRate = Number(selectedTechnician?.hourly_rate || 0);

    if (!vehicleId || !workOrder?.id) {
      setErrorMessage("Unable to add labor without a work order.");
      return;
    }

    if (!selectedTechnician?.id) {
      setErrorMessage("A technician profile is required.");
      return;
    }

    if (!Number.isFinite(hours) || hours <= 0) {
      setErrorMessage("Hours must be greater than 0.");
      return;
    }

    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      setErrorMessage("Hourly rate must be 0 or greater.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const laborLog = {
        vehicle_id: vehicleId,
        repair_job_id: workOrder.id,
        technician_id: selectedTechnician.id,
        hours,
        hourly_rate: hourlyRate,
        notes: emptyToNull(formData.notes),
      };

      const { data, error } = await supabase
        .from("labor_logs")
        .insert([laborLog])
        .select("*")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setFormData(emptyForm);
      setSuccessMessage("Labor added successfully.");
      await logVehicleActivity({
        vehicleId,
        action: "Labor log added",
        details: {
          repair_job: getWorkOrderTitle(workOrder),
          technician: getTechnicianName(selectedTechnician),
          hours: laborLog.hours,
          hourly_rate: laborLog.hourly_rate,
        },
      });
      onActivityLogged?.();
      await onLaborAdded?.(data ?? laborLog);
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {getWorkOrderTitle(workOrder)}
            </p>
            <h3 className="mt-1 text-lg font-bold text-zinc-950">
              Add Labor
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Record time for this work order.
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
          {canPickTechnician && (
            <label className="block" htmlFor="work-order-labor-technician">
              <span className="text-sm font-medium text-zinc-700">
                Technician
              </span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="work-order-labor-technician"
                name="technician_id"
                onChange={handleChange}
                value={formData.technician_id}
              >
                <option value="">Use my profile rate</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {getTechnicianName(profile)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block" htmlFor="work-order-labor-hours">
            <span className="text-sm font-medium text-zinc-700">Hours</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
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

          <label className="block" htmlFor="work-order-labor-notes">
            <span className="text-sm font-medium text-zinc-700">Notes</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="work-order-labor-notes"
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
              {isSubmitting ? "Adding..." : "Add Labor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddWorkOrderLaborForm;
