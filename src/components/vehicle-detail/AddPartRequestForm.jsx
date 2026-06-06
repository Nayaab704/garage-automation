import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { formControlClassNames } from "../ui/uiStyles";
import { logVehicleActivity } from "../../lib/activityLogger";
import { formatRepairProcessType } from "../../lib/repairProcess";
import { supabase } from "../../lib/supabaseClient";

const emptyForm = {
  part_name: "",
  quantity: "1",
  repair_job_id: "",
  repair_process_id: "",
  notes: "",
};

function emptyToNull(value) {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function getRepairJobTitle(repairJob) {
  return (
    repairJob.title ??
    repairJob.name ??
    repairJob.job_title ??
    repairJob.repair_title ??
    "Untitled Repair Job"
  );
}

function AddPartRequestForm({
  currentProfile,
  onClose,
  onActivityLogged,
  onPartRequestAdded,
  repairProcesses = [],
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

  async function handleSubmit(event) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const partName = emptyToNull(formData.part_name);
      const quantity = Number(formData.quantity);

      if (!partName) {
        setErrorMessage("Part name is required.");
        return;
      }

      if (!Number.isInteger(quantity) || quantity < 1) {
        setErrorMessage("Quantity must be a whole number of at least 1.");
        return;
      }

      const partRequest = {
        vehicle_id: vehicleId,
        part_name: partName,
        quantity,
        part_source: "needs_to_buy",
        approval_status: "pending",
        status: "requested",
        unit_cost: 0,
        created_by: currentProfile?.id ?? null,
        repair_job_id: formData.repair_job_id || null,
        repair_process_id: formData.repair_process_id || null,
        notes: emptyToNull(formData.notes),
      };

      const { error } = await supabase
        .from("part_requests")
        .insert([partRequest]);

      if (error) {
        setErrorMessage(error.message);
      } else {
        setFormData(emptyForm);
        setSuccessMessage("Part request added successfully.");
        await logVehicleActivity({
          vehicleId,
          action: "Part request created",
          details: {
            part_name: partRequest.part_name,
            quantity: partRequest.quantity,
          },
        });
        onActivityLogged?.();
        await onPartRequestAdded();
      }
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="Request a part for this vehicle."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      title="Add Part Request"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block" htmlFor="part-name">
            <span className={formControlClassNames.label}>Part Name</span>
            <input
              className={formControlClassNames.input}
              id="part-name"
              name="part_name"
              onChange={handleChange}
              required
              type="text"
              value={formData.part_name}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="part-quantity">
              <span className={formControlClassNames.label}>Quantity</span>
              <input
                className={formControlClassNames.input}
                id="part-quantity"
                min="1"
                name="quantity"
                onChange={handleChange}
                required
                step="1"
                type="number"
                value={formData.quantity}
              />
            </label>

            <label className="block" htmlFor="part-repair-job">
              <span className={formControlClassNames.label}>Repair Job</span>
              <select
                className={formControlClassNames.select}
                id="part-repair-job"
                name="repair_job_id"
                onChange={handleChange}
                value={formData.repair_job_id}
              >
                <option value="">No repair job selected</option>
                {repairJobs.map((repairJob) => (
                  <option key={repairJob.id} value={repairJob.id}>
                    {getRepairJobTitle(repairJob)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block" htmlFor="part-repair-process">
            <span className={formControlClassNames.label}>
              Repair Process
            </span>
            <select
              className={formControlClassNames.select}
              id="part-repair-process"
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

          <label className="block" htmlFor="part-notes">
            <span className={formControlClassNames.label}>Notes</span>
            <textarea
              className={formControlClassNames.textarea}
              id="part-notes"
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
            submitLabel="Add Part Request"
            submittingLabel="Adding..."
          />
        </form>
    </ModalShell>
  );
}

export default AddPartRequestForm;
