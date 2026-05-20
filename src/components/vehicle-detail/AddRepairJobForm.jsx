import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import { formatRepairProcessType } from "../../lib/repairProcess";
import { supabase } from "../../lib/supabaseClient";

const emptyForm = {
  title: "",
  category: "",
  priority: "medium",
  repair_process_id: "",
  notes: "",
};

function emptyToNull(value) {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function AddRepairJobForm({
  onClose,
  onActivityLogged,
  onRepairJobAdded,
  repairProcesses = [],
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

  async function handleSubmit(event) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const repairJob = {
        vehicle_id: vehicleId,
        title: emptyToNull(formData.title),
        category: emptyToNull(formData.category),
        priority: emptyToNull(formData.priority),
        repair_process_id: formData.repair_process_id || null,
        notes: emptyToNull(formData.notes),
      };

      const { error } = await supabase.from("repair_jobs").insert([repairJob]);

      if (error) {
        setErrorMessage(error.message);
      } else {
        setFormData(emptyForm);
        setSuccessMessage("Repair job added successfully.");
        await logVehicleActivity({
          vehicleId,
          action: "Repair job created",
          details: {
            title: repairJob.title,
            category: repairJob.category,
            priority: repairJob.priority,
          },
        });
        onActivityLogged?.();
        await onRepairJobAdded();
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
              Add Repair Job
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Create a repair task for this vehicle.
            </p>
          </div>

          <button
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block" htmlFor="repair-title">
            <span className="text-sm font-medium text-zinc-700">Title</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="repair-title"
              name="title"
              onChange={handleChange}
              required
              type="text"
              value={formData.title}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="repair-category">
              <span className="text-sm font-medium text-zinc-700">
                Category
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="repair-category"
                name="category"
                onChange={handleChange}
                type="text"
                value={formData.category}
              />
            </label>

            <label className="block" htmlFor="repair-priority">
              <span className="text-sm font-medium text-zinc-700">
                Priority
              </span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="repair-priority"
                name="priority"
                onChange={handleChange}
                value={formData.priority}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>

          <label className="block" htmlFor="repair-process">
            <span className="text-sm font-medium text-zinc-700">
              Repair Process
            </span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="repair-process"
              name="repair_process_id"
              onChange={handleChange}
              value={formData.repair_process_id}
            >
              <option value="">No repair process selected</option>
              {repairProcesses.map((repairProcess) => (
                <option key={repairProcess.id} value={repairProcess.id}>
                  {formatRepairProcessType(repairProcess.process_type)}
                </option>
              ))}
            </select>
          </label>

          <label className="block" htmlFor="repair-notes">
            <span className="text-sm font-medium text-zinc-700">Notes</span>
            <textarea
              className="mt-1 min-h-28 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="repair-notes"
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
              {isSubmitting ? "Adding..." : "Add Repair Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddRepairJobForm;
