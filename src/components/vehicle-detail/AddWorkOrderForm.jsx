import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import { isPhaseOneServiceCategory } from "../../lib/serviceCategoryVisuals";
import { supabase } from "../../lib/supabaseClient";

const emptyForm = {
  title: "",
  priority: "medium",
  status: "needed",
  notes: "",
};

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const statusOptions = [
  { value: "needed", label: "Needed" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_parts", label: "Waiting Parts" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const allowedPriorities = priorityOptions.map((option) => option.value);
const allowedStatuses = statusOptions.map((option) => option.value);

function emptyToNull(value) {
  const trimmedValue = String(value ?? "").trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function slugifyCategoryName(value) {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "service_work";
}

function getCompatibilityCategory(category) {
  return emptyToNull(category?.slug) ?? slugifyCategoryName(category?.name);
}

function getValidPriority(value) {
  return allowedPriorities.includes(value) ? value : "medium";
}

function getValidStatus(value) {
  return allowedStatuses.includes(value) ? value : "needed";
}

function AddWorkOrderForm({
  category,
  currentProfile,
  onActivityLogged,
  onClose,
  onWorkOrderAdded,
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

    const title = emptyToNull(formData.title);

    if (!title) {
      setErrorMessage("Enter a work order title.");
      return;
    }

    if (!vehicleId || !category?.id) {
      setErrorMessage("Unable to create a work order for this category.");
      return;
    }

    if (!isPhaseOneServiceCategory(category)) {
      setErrorMessage("This service category is not active for Phase 1.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const workOrder = {
        vehicle_id: vehicleId,
        service_category_id: category.id,
        category: getCompatibilityCategory(category),
        title,
        priority: getValidPriority(formData.priority),
        status: getValidStatus(formData.status),
        notes: emptyToNull(formData.notes),
        created_by: currentProfile?.id ?? null,
        assigned_to:
          currentProfile?.role === "technician" && currentProfile.id
            ? currentProfile.id
            : null,
      };

      const { error } = await supabase.from("repair_jobs").insert([workOrder]);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setFormData(emptyForm);
      setSuccessMessage("Work order added successfully.");
      await logVehicleActivity({
        vehicleId,
        action: "Work order created",
        details: {
          category: category.name,
          priority: workOrder.priority,
          status: workOrder.status,
          title: workOrder.title,
        },
      });
      onActivityLogged?.();
      await onWorkOrderAdded?.();
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
              {category?.name ?? "Service Category"}
            </p>
            <h3 className="mt-1 text-lg font-bold text-zinc-950">
              Add Work Order
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Create a service issue for this vehicle.
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
          <label className="block" htmlFor="work-order-title">
            <span className="text-sm font-medium text-zinc-700">Title</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="work-order-title"
              name="title"
              onChange={handleChange}
              required
              type="text"
              value={formData.title}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="work-order-priority">
              <span className="text-sm font-medium text-zinc-700">
                Priority
              </span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="work-order-priority"
                name="priority"
                onChange={handleChange}
                value={formData.priority}
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block" htmlFor="work-order-status">
              <span className="text-sm font-medium text-zinc-700">Status</span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="work-order-status"
                name="status"
                onChange={handleChange}
                value={formData.status}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block" htmlFor="work-order-notes">
            <span className="text-sm font-medium text-zinc-700">Notes</span>
            <textarea
              className="mt-1 min-h-28 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="work-order-notes"
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
              {isSubmitting ? "Adding..." : "Add Work Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddWorkOrderForm;
