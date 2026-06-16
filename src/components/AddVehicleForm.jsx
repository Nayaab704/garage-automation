import { useState } from "react";
import {
  buttonClassNames,
  cardClassNames,
  formControlClassNames,
} from "./ui/uiStyles";
import AppIcon from "./ui/AppIcon";
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

const basicFields = [
  {
    name: "vin",
    label: "VIN",
    placeholder: "17-character VIN",
    type: "text",
    maxLength: 17,
    inputClassName: "font-mono uppercase tracking-wide",
    layoutClassName: "md:col-span-2",
  },
  {
    name: "year",
    label: "Year",
    min: "1900",
    placeholder: "2020",
    step: "1",
    type: "number",
  },
  {
    name: "make",
    label: "Make",
    placeholder: "Toyota",
    required: true,
    type: "text",
  },
  {
    name: "model",
    label: "Model",
    placeholder: "Camry",
    required: true,
    type: "text",
  },
  { name: "trim", label: "Trim", placeholder: "LE", type: "text" },
  { name: "color", label: "Color", placeholder: "White", type: "text" },
  {
    name: "mileage",
    label: "Mileage",
    min: "0",
    placeholder: "85000",
    step: "1",
    type: "number",
  },
];

const purchaseNumberFields = [
  {
    name: "purchase_price",
    label: "Purchase Price",
    min: "0",
    placeholder: "0.00",
    step: "0.01",
  },
  {
    name: "target_sale_price",
    label: "Target Sale Price",
    min: "0",
    placeholder: "0.00",
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

function IntakeFormSection({ children, description, icon, title }) {
  return (
    <fieldset className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5">
      <legend className="sr-only">{title}</legend>
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
          <AppIcon name={icon} size={20} />
        </span>
        <div>
          <h3 className="text-base font-black text-slate-950">{title}</h3>
          {description && (
            <p className="mt-1 text-sm leading-5 text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </fieldset>
  );
}

function AddVehicleForm({ initialValues = {}, onBack, onVehicleAdded }) {
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
    <section className="mx-auto w-full max-w-4xl">
      <div className={`overflow-hidden bg-white/95 ${cardClassNames.elevated}`}>
        <div className="border-b border-slate-100 bg-gradient-to-br from-white via-emerald-50/40 to-white p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
                <AppIcon name="vehicle" size={24} />
              </span>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-950">
                  Vehicle Details
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Complete the vehicle information before creating the record.
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  Stock number will be generated after creation.
                </p>
              </div>
            </div>

            {onBack && (
              <button
                className={`shrink-0 ${buttonClassNames.secondary}`}
                disabled={isSubmitting}
                onClick={onBack}
                type="button"
              >
                <AppIcon className="rotate-180" name="chevron-right" size={18} />
                Back to VIN
              </button>
            )}
          </div>

          {formData.vin && (
            <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-100 bg-white/80 px-3 py-1.5 text-xs font-black text-emerald-800 shadow-sm">
              <AppIcon name="scan" size={14} />
              <span className="truncate font-mono tracking-wide">
                {formData.vin}
              </span>
            </div>
          )}
        </div>

        <form
          className="space-y-4 p-4 sm:space-y-5 sm:p-6"
          onSubmit={handleSubmit}
        >
          <IntakeFormSection
            description="VIN stays editable. Add the visible inventory details customers and technicians will use."
            icon="car"
            title="Basic Details"
          >
            <div className="grid gap-4 md:grid-cols-2">
              {basicFields.map((field) => (
                <label
                  className={`block ${field.layoutClassName ?? ""}`}
                  htmlFor={field.name}
                  key={field.name}
                >
                  <span className={formControlClassNames.label}>
                    {field.label}
                  </span>
                  <input
                    className={`${formControlClassNames.input} ${
                      field.inputClassName ?? ""
                    }`}
                    id={field.name}
                    maxLength={field.maxLength}
                    min={field.min}
                    name={field.name}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    required={field.required}
                    step={field.step}
                    type={field.type}
                    value={formData[field.name]}
                  />
                </label>
              ))}
            </div>
          </IntakeFormSection>

          <IntakeFormSection
            description="Add purchase context and title information for manager review."
            icon="dollar"
            title="Purchase Details"
          >
            <div className="grid gap-4 md:grid-cols-2">
              {purchaseNumberFields.map((field) => (
                <label className="block" htmlFor={field.name} key={field.name}>
                  <span className={formControlClassNames.label}>
                    {field.label}
                  </span>
                  <input
                    className={formControlClassNames.input}
                    id={field.name}
                    min={field.min}
                    name={field.name}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    step={field.step}
                    type="number"
                    value={formData[field.name]}
                  />
                </label>
              ))}

              <label className="block" htmlFor="title_status">
                <span className={formControlClassNames.label}>Title Status</span>
                <select
                  className={formControlClassNames.select}
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
                <span className={formControlClassNames.label}>
                  Vehicle Origin
                </span>
                <select
                  className={formControlClassNames.select}
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

              <label className="block md:col-span-2" htmlFor="notes">
                <span className={formControlClassNames.label}>Notes</span>
                <textarea
                  className={formControlClassNames.textarea}
                  id="notes"
                  name="notes"
                  onChange={handleChange}
                  placeholder="Optional intake notes"
                  value={formData.notes}
                />
              </label>
            </div>
          </IntakeFormSection>

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

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            {onBack && (
              <button
                className={`w-full sm:w-auto ${buttonClassNames.secondary}`}
                disabled={isSubmitting}
                onClick={onBack}
                type="button"
              >
                Back
              </button>
            )}

            <button
              className={`w-full sm:w-auto ${buttonClassNames.primary}`}
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Creating..." : "Create Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default AddVehicleForm;
