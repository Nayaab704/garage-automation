import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { vehicleOriginOptions } from "../lib/vehicleOrigin";

const emptyForm = {
  vin: "",
  year: "",
  make: "",
  model: "",
  trim: "",
  mileage: "",
  color: "",
  title_status: "unknown",
  vehicle_origin: "unknown",
  purchase_price: "",
  target_sale_price: "",
  notes: "",
};

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

const titleStatusOptions = [
  { value: "clean", label: "Clean Title" },
  { value: "salvage", label: "Salvage" },
  { value: "rebuilt", label: "Rebuilt" },
  { value: "flood", label: "Flood" },
  { value: "unknown", label: "Unknown" },
];

const allowedTitleStatuses = titleStatusOptions.map((option) => option.value);
const allowedVehicleOrigins = vehicleOriginOptions.map((option) => option.value);

function emptyToNull(value) {
  const trimmedValue = String(value ?? "").trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function numberOrNull(value) {
  const trimmedValue = String(value ?? "").trim();

  if (trimmedValue === "") {
    return null;
  }

  const numberValue = Number(trimmedValue);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function decimalOrZero(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeVin(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .toUpperCase()
    .slice(0, 17);
}

function getValidTitleStatus(value) {
  return allowedTitleStatuses.includes(value) ? value : "unknown";
}

function getValidVehicleOrigin(value) {
  return allowedVehicleOrigins.includes(value) ? value : "unknown";
}

function buildInitialFormData(initialValues = {}) {
  return {
    ...emptyForm,
    ...initialValues,
    vin: normalizeVin(initialValues.vin),
    title_status: getValidTitleStatus(
      initialValues.title_status ?? emptyForm.title_status
    ),
    vehicle_origin: getValidVehicleOrigin(
      initialValues.vehicle_origin ?? emptyForm.vehicle_origin
    ),
  };
}

function buildVehiclePayload(formData) {
  return {
    vin: emptyToNull(normalizeVin(formData.vin)),
    year: numberOrNull(formData.year),
    make: emptyToNull(formData.make),
    model: emptyToNull(formData.model),
    trim: emptyToNull(formData.trim),
    mileage: numberOrNull(formData.mileage),
    color: emptyToNull(formData.color),
    title_status: getValidTitleStatus(formData.title_status),
    vehicle_origin: getValidVehicleOrigin(formData.vehicle_origin),
    purchase_price: decimalOrZero(formData.purchase_price),
    target_sale_price: decimalOrZero(formData.target_sale_price),
    notes: emptyToNull(formData.notes),
  };
}

function AddVehicleForm({ initialValues = {}, onVehicleAdded }) {
  const [formData, setFormData] = useState(() =>
    buildInitialFormData(initialValues)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    const nextValue = name === "vin" ? normalizeVin(value) : value;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: nextValue,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const vehiclePayload = buildVehiclePayload(formData);
      const { data, error } = await supabase
        .from("vehicles")
        .insert([vehiclePayload])
        .select("id, stock_number, vin")
        .single();

      if (error) {
        setErrorMessage(error.message);
      } else {
        setFormData(buildInitialFormData(initialValues));
        setSuccessMessage(
          data?.stock_number
            ? `Vehicle added successfully. Stock number: ${data.stock_number}.`
            : "Vehicle added successfully."
        );
        await onVehicleAdded?.(data);
      }
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Add Vehicle</h2>
        <p className="mt-1 text-sm text-slate-600">
          Create a new inventory record.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          {textFields.map((field) => (
            <label
              className="block"
              htmlFor={field.name}
              key={field.name}
            >
              <span className="text-sm font-medium text-slate-700">
                {field.label}
              </span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                id={field.name}
                maxLength={field.name === "vin" ? 17 : undefined}
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
              htmlFor={field.name}
              key={field.name}
            >
              <span className="text-sm font-medium text-slate-700">
                {field.label}
              </span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                id={field.name}
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
          <label className="block" htmlFor="title_status">
            <span className="text-sm font-medium text-slate-700">
              Title Status
            </span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              id="title_status"
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

          <label className="block" htmlFor="vehicle_origin">
            <span className="text-sm font-medium text-slate-700">
              Vehicle Origin
            </span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              id="vehicle_origin"
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

        <label className="block" htmlFor="notes">
          <span className="text-sm font-medium text-slate-700">Notes</span>
          <textarea
            className="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            id="notes"
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

        <button
          className="w-full rounded-md bg-slate-900 px-4 py-2.5 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Adding Vehicle..." : "Add Vehicle"}
        </button>
      </form>
    </section>
  );
}

export default AddVehicleForm;
