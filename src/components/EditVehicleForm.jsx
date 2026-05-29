import { useState } from "react";
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
      const { error } = await supabase
        .from("vehicles")
        .update(vehiclePayload)
        .eq("id", vehicle.id);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      await onVehicleUpdated();
      onClose();
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-950">Edit Vehicle</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Update this vehicle inventory record.
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
            {textFields.map((field) => (
              <label
                className="block"
                htmlFor={`edit-${field.name}`}
                key={field.name}
              >
                <span className="text-sm font-medium text-zinc-700">
                  {field.label}
                </span>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
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

          <div className="grid gap-4 sm:grid-cols-2">
            {numberFields.map((field) => (
              <label
                className="block"
                htmlFor={`edit-${field.name}`}
                key={field.name}
              >
                <span className="text-sm font-medium text-zinc-700">
                  {field.label}
                </span>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
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
              <span className="text-sm font-medium text-zinc-700">
                Title Status
              </span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
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
              <span className="text-sm font-medium text-zinc-700">
                Vehicle Origin
              </span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
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

          <label className="block" htmlFor="edit-notes">
            <span className="text-sm font-medium text-zinc-700">Notes</span>
            <textarea
              className="mt-1 min-h-28 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="edit-notes"
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
              {isSubmitting ? "Saving..." : "Save Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditVehicleForm;
