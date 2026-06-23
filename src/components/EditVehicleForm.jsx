import { useState } from "react";
import FormActions from "./ui/FormActions";
import FormMessage from "./ui/FormMessage";
import ModalShell from "./ui/ModalShell";
import { formControlClassNames } from "./ui/uiStyles";
import { supabase } from "../lib/supabaseClient";
import { vehicleOriginOptions } from "../lib/vehicleOrigin";

const titleStatusOptions = [
  { value: "clean", label: "Clean Title" },
  { value: "salvage", label: "Salvage" },
  { value: "rebuilt", label: "Rebuilt" },
  { value: "flood", label: "Flood" },
  { value: "unknown", label: "Unknown" },
];

const textFields = [
  { name: "vin", label: "VIN" },
  { name: "make", label: "Make", required: true },
  { name: "model", label: "Model", required: true },
  { name: "trim", label: "Trim" },
  { name: "color", label: "Color" },
];

const numberFields = [
  { name: "year", label: "Year", min: "1900", step: "1" },
  { name: "mileage", label: "Mileage", min: "0", step: "1" },
  {
    name: "purchase_price",
    label: "Purchase Price",
    min: "0",
    step: "0.01",
  },
  {
    name: "target_sale_price",
    label: "Target Sale Price",
    min: "0",
    step: "0.01",
  },
];

function emptyToNull(value) {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function numberOrNull(value) {
  if (value === "") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function decimalOrNull(value) {
  if (value === "") {
    return null;
  }

  const numberValue = parseFloat(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function valueToString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function getInitialFormData(vehicle) {
  return {
    vin: valueToString(vehicle.vin),
    year: valueToString(vehicle.year),
    make: valueToString(vehicle.make),
    model: valueToString(vehicle.model),
    trim: valueToString(vehicle.trim),
    mileage: valueToString(vehicle.mileage),
    color: valueToString(vehicle.color),
    title_status: vehicle.title_status ?? "unknown",
    vehicle_origin: vehicle.vehicle_origin ?? "unknown",
    purchase_price: valueToString(vehicle.purchase_price),
    target_sale_price: valueToString(vehicle.target_sale_price),
    notes: valueToString(vehicle.notes),
  };
}

function buildVehiclePayload(formData) {
  return {
    vin: emptyToNull(formData.vin),
    year: numberOrNull(formData.year),
    make: emptyToNull(formData.make),
    model: emptyToNull(formData.model),
    trim: emptyToNull(formData.trim),
    mileage: numberOrNull(formData.mileage),
    color: emptyToNull(formData.color),
    title_status: formData.title_status,
    vehicle_origin: formData.vehicle_origin,
    purchase_price: decimalOrNull(formData.purchase_price),
    target_sale_price: decimalOrNull(formData.target_sale_price),
    notes: emptyToNull(formData.notes),
  };
}

function EditVehicleForm({ onClose, onVehicleUpdated, vehicle }) {
  const [formData, setFormData] = useState(() => getInitialFormData(vehicle));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!vehicle.id) {
      setErrorMessage("Unable to update a vehicle without an ID.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const vehiclePayload = buildVehiclePayload(formData);
      const { data, error } = await supabase
        .from("vehicles")
        .update(vehiclePayload)
        .eq("id", vehicle.id)
        .select("*")
        .single();

      if (error) {
        console.error("Could not save vehicle:", error);
        setErrorMessage("Could not save vehicle. Please try again.");
        return;
      }

      await onVehicleUpdated(data ?? { ...vehicle, ...vehiclePayload });
      onClose();
    } catch (error) {
      console.error("Could not save vehicle:", error);
      setErrorMessage("Could not save vehicle. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="Update this vehicle inventory record."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      size="lg"
      title="Edit Vehicle"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <fieldset className="space-y-4">
            <legend className="text-sm font-black text-slate-950">
              Basic Details
            </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {textFields.map((field) => (
              <label
                className="block"
                htmlFor={`edit-${field.name}`}
                key={field.name}
              >
                <span className={formControlClassNames.label}>
                  {field.label}
                </span>
                <input
                  className={formControlClassNames.input}
                  id={`edit-${field.name}`}
                  name={field.name}
                  onChange={handleChange}
                  required={field.required}
                  type="text"
                  value={formData[field.name]}
                />
              </label>
            ))}
          </div>
          </fieldset>

          <fieldset className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
            <legend className="px-1 text-sm font-black text-slate-950">
              Vehicle / Financial Details
            </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {numberFields.map((field) => (
              <label
                className="block"
                htmlFor={`edit-${field.name}`}
                key={field.name}
              >
                <span className={formControlClassNames.label}>
                  {field.label}
                </span>
                <input
                  className={formControlClassNames.input}
                  id={`edit-${field.name}`}
                  min={field.min}
                  name={field.name}
                  onChange={handleChange}
                  step={field.step}
                  type="number"
                  value={formData[field.name]}
                />
              </label>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="edit-title-status">
              <span className={formControlClassNames.label}>
                Title Status
              </span>
              <select
                className={formControlClassNames.select}
                id="edit-title-status"
                name="title_status"
                onChange={handleChange}
                value={formData.title_status}
              >
                {titleStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block" htmlFor="edit-vehicle-origin">
              <span className={formControlClassNames.label}>
                Vehicle Origin
              </span>
              <select
                className={formControlClassNames.select}
                id="edit-vehicle-origin"
                name="vehicle_origin"
                onChange={handleChange}
                value={formData.vehicle_origin}
              >
                {vehicleOriginOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          </fieldset>

          <label className="block" htmlFor="edit-notes">
            <span className={formControlClassNames.label}>Notes</span>
            <textarea
              className={formControlClassNames.textarea}
              id="edit-notes"
              name="notes"
              onChange={handleChange}
              value={formData.notes}
            />
          </label>

          <FormMessage tone="error">{errorMessage}</FormMessage>

          <FormActions
            isSubmitting={isSubmitting}
            onCancel={onClose}
            submitLabel="Save Vehicle"
            submittingLabel="Saving..."
          />
        </form>
    </ModalShell>
  );
}

export default EditVehicleForm;
