import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { formControlClassNames } from "../ui/uiStyles";
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
    <ModalShell
      description="Create a repair task for this vehicle."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      title="Add Repair Job"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block" htmlFor="repair-title">
            <span className={formControlClassNames.label}>Title</span>
            <input
              className={formControlClassNames.input}
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
              <span className={formControlClassNames.label}>Category</span>
              <input
                className={formControlClassNames.input}
                id="repair-category"
                name="category"
                onChange={handleChange}
                type="text"
                value={formData.category}
              />
            </label>

            <label className="block" htmlFor="repair-priority">
              <span className={formControlClassNames.label}>Priority</span>
              <select
                className={formControlClassNames.select}
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
            <span className={formControlClassNames.label}>
              Repair Process
            </span>
            <select
              className={formControlClassNames.select}
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
            <span className={formControlClassNames.label}>Notes</span>
            <textarea
              className={formControlClassNames.textarea}
              id="repair-notes"
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
            submitLabel="Add Repair Job"
            submittingLabel="Adding..."
          />
        </form>
    </ModalShell>
  );
}

export default AddRepairJobForm;
