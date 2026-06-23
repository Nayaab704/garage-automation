import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { formControlClassNames } from "../ui/uiStyles";
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

    if (isSubmitting) {
      return;
    }

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
          technician: getTechnicianName(selectedTechnician),
          hours: laborLog.hours,
          hourly_rate: laborLog.hourly_rate,
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
