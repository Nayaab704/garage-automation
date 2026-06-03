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

const basicNumberFields = [
  { name: "year", label: "Year", min: "1900", step: "1" },
  { name: "mileage", label: "Mileage", min: "0", step: "1" },
];

const adminNumberFields = [
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

const inputClassName =
  "mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100";

const selectClassName =
  "mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100";

const labelClassName = "text-sm font-bold text-slate-700";

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
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-black text-slate-950">Vehicle Details</h2>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <fieldset className="space-y-4">
          <legend className="text-sm font-black text-slate-950">
            Basic Details
          </legend>
          <div className="grid gap-4 md:grid-cols-2">
            {textFields.map((field) => (
              <label className="block" htmlFor={field.name} key={field.name}>
                <span className={labelClassName}>{field.label}</span>
                <input
                  className={`${inputClassName} ${
                    field.name === "vin" ? "font-mono uppercase tracking-wide" : ""
                  }`}
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

            {basicNumberFields.map((field) => (
              <label className="block" htmlFor={field.name} key={field.name}>
                <span className={labelClassName}>{field.label}</span>
                <input
                  className={inputClassName}
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
        </fieldset>

        <fieldset className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
          <legend className="px-1 text-sm font-black text-slate-950">
            Purchase / Admin Details
          </legend>
          <div className="grid gap-4 md:grid-cols-2">
            {adminNumberFields.map((field) => (
              <label className="block" htmlFor={field.name} key={field.name}>
                <span className={labelClassName}>{field.label}</span>
                <input
                  className={inputClassName}
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

            <label className="block" htmlFor="title_status">
              <span className={labelClassName}>Title Status</span>
              <select
                className={selectClassName}
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
              <span className={labelClassName}>Vehicle Origin</span>
              <select
                className={selectClassName}
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
        </fieldset>

        <label className="block" htmlFor="notes">
          <span className={labelClassName}>Notes</span>
          <textarea
            className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
            id="notes"
            name="notes"
            onChange={handleChange}
            value={formData.notes}
          />
        </label>

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {successMessage}
          </div>
        )}

        <button
          className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creating Vehicle..." : "Create Vehicle"}
        </button>
      </form>
    </section>
  );
}

export default AddVehicleForm;
