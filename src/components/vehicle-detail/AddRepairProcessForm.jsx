import { useState } from "react";
import {
  repairProcessStatusOptions,
  repairProcessTypeOptions,
} from "../../lib/repairProcess";
import { supabase } from "../../lib/supabaseClient";

const emptyForm = {
  process_type: "in_house",
  status: "not_started",
  vendor_id: "",
  estimated_cost: "",
  actual_cost: "",
  notes: "",
};

function emptyToNull(value) {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function getFirstValue(record, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = record[fieldName];

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

function getVendorName(vendor) {
  return (
    getFirstValue(vendor, ["name", "vendor_name", "company_name"]) ??
    "Unnamed Vendor"
  );
}

function parseOptionalCost(value, label) {
  const numberValue = Number(value || 0);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return { error: `${label} must be 0 or greater.`, value: null };
  }

  return { error: "", value: numberValue };
}

function validateForm(formData) {
  const estimatedCost = parseOptionalCost(
    formData.estimated_cost,
    "Estimated cost"
  );
  const actualCost = parseOptionalCost(formData.actual_cost, "Actual cost");

  if (estimatedCost.error) {
    return { error: estimatedCost.error };
  }

  if (actualCost.error) {
    return { error: actualCost.error };
  }

  return {
    error: "",
    values: {
      actualCost: actualCost.value,
      estimatedCost: estimatedCost.value,
    },
  };
}

function AddRepairProcessForm({
  onClose,
  onRepairProcessAdded,
  vehicleId,
  vendors = [],
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

    if (!vehicleId) {
      setErrorMessage("Unable to add a repair process without a vehicle.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const validation = validateForm(formData);

      if (validation.error) {
        setErrorMessage(validation.error);
        return;
      }

      const repairProcess = {
        vehicle_id: vehicleId,
        process_type: formData.process_type,
        status: formData.status,
        vendor_id: formData.vendor_id || null,
        estimated_cost: validation.values.estimatedCost,
        actual_cost: validation.values.actualCost,
        notes: emptyToNull(formData.notes),
      };

      const { error } = await supabase
        .from("repair_processes")
        .insert([repairProcess]);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setFormData(emptyForm);
      setSuccessMessage("Repair process added successfully.");
      await onRepairProcessAdded();
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
            <h3 className="text-lg font-bold text-zinc-950">
              Add Repair Process
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Track how this vehicle is moving through repair work.
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
            <label className="block" htmlFor="repair-process-type">
              <span className="text-sm font-medium text-zinc-700">
                Process Type
              </span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="repair-process-type"
                name="process_type"
                onChange={handleChange}
                value={formData.process_type}
              >
                {repairProcessTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block" htmlFor="repair-process-status">
              <span className="text-sm font-medium text-zinc-700">
                Status
              </span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="repair-process-status"
                name="status"
                onChange={handleChange}
                value={formData.status}
              >
                {repairProcessStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block" htmlFor="repair-process-vendor">
            <span className="text-sm font-medium text-zinc-700">
              Vendor
            </span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="repair-process-vendor"
              name="vendor_id"
              onChange={handleChange}
              value={formData.vendor_id}
            >
              <option value="">No vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {getVendorName(vendor)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="repair-process-estimated-cost">
              <span className="text-sm font-medium text-zinc-700">
                Estimated Cost
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="repair-process-estimated-cost"
                min="0"
                name="estimated_cost"
                onChange={handleChange}
                step="0.01"
                type="number"
                value={formData.estimated_cost}
              />
            </label>

            <label className="block" htmlFor="repair-process-actual-cost">
              <span className="text-sm font-medium text-zinc-700">
                Actual Cost
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="repair-process-actual-cost"
                min="0"
                name="actual_cost"
                onChange={handleChange}
                step="0.01"
                type="number"
                value={formData.actual_cost}
              />
            </label>
          </div>

          <label className="block" htmlFor="repair-process-notes">
            <span className="text-sm font-medium text-zinc-700">Notes</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="repair-process-notes"
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
              {isSubmitting ? "Adding..." : "Add Repair Process"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddRepairProcessForm;
