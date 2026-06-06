import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { formControlClassNames } from "../ui/uiStyles";
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
    <ModalShell
      description="Create a service issue for this vehicle."
      eyebrow={category?.name ?? "Service Category"}
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      title="Add Work Order"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block" htmlFor="work-order-title">
            <span className={formControlClassNames.label}>Title</span>
            <input
              className={formControlClassNames.input}
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
              <span className={formControlClassNames.label}>Priority</span>
              <select
                className={formControlClassNames.select}
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
              <span className={formControlClassNames.label}>Status</span>
              <select
                className={formControlClassNames.select}
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
            <span className={formControlClassNames.label}>Notes</span>
            <textarea
              className={formControlClassNames.textarea}
              id="work-order-notes"
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
            submitLabel="Add Work Order"
            submittingLabel="Adding..."
          />
        </form>
    </ModalShell>
  );
}

export default AddWorkOrderForm;
