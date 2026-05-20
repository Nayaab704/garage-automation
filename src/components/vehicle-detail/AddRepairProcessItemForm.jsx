import { useState } from "react";
import {
  formatRepairProcessType,
  repairProcessItemStatusOptions,
} from "../../lib/repairProcess";
import { supabase } from "../../lib/supabaseClient";

const emptyForm = {
  category_name: "Collision / Structural Damage",
  custom_category_name: "",
  status: "pending",
  estimated_cost: "",
  actual_cost: "",
  notes: "",
};

const categoryOptionsByProcessType = {
  in_house: [
    "Collision / Structural Damage",
    "Cosmetic / Paint Repair",
    "Electrical Repair",
    "Water Damage",
    "Mechanical Repair",
    "Interior Repair",
    "Detailing",
    "Other",
  ],
  third_party: [
    "Body Shop Repair",
    "Mechanical Shop Repair",
    "Electrical Specialist",
    "Paint Shop",
    "Alignment / Suspension Shop",
    "Glass Repair",
    "Other",
  ],
  parts_accessories: [
    "Replacement Part",
    "Accessory",
    "Key / Remote",
    "Tires / Wheels",
    "Battery",
    "Interior Accessory",
    "Exterior Accessory",
    "Other",
  ],
};

function emptyToNull(value) {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function parseCost(value, label) {
  const numberValue = Number(value || 0);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return { error: `${label} must be 0 or greater.`, value: null };
  }

  return { error: "", value: numberValue };
}

function getCategoryOptions(processType) {
  return (
    categoryOptionsByProcessType[processType] ??
    categoryOptionsByProcessType.in_house
  );
}

function getInitialFormData(processType) {
  const categoryOptions = getCategoryOptions(processType);

  return {
    ...emptyForm,
    category_name: categoryOptions[0],
  };
}

function getSelectedCategoryName(formData) {
  if (formData.category_name === "Other") {
    return emptyToNull(formData.custom_category_name);
  }

  return emptyToNull(formData.category_name);
}

function validateForm(formData) {
  const categoryName = getSelectedCategoryName(formData);
  const estimatedCost = parseCost(formData.estimated_cost, "Estimated cost");
  const actualCost = parseCost(formData.actual_cost, "Actual cost");

  if (!categoryName) {
    return { error: "Category name is required." };
  }

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
      categoryName,
      estimatedCost: estimatedCost.value,
    },
  };
}

function AddRepairProcessItemForm({
  onClose,
  onItemAdded,
  repairProcess,
  vehicleId,
}) {
  const [formData, setFormData] = useState(() =>
    getInitialFormData(repairProcess?.process_type)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const categoryOptions = getCategoryOptions(repairProcess?.process_type);
  const isCustomCategory = formData.category_name === "Other";

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!vehicleId || !repairProcess?.id) {
      setErrorMessage("Unable to add an item without a repair process.");
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

      const repairProcessItem = {
        repair_process_id: repairProcess.id,
        vehicle_id: vehicleId,
        category_name: validation.values.categoryName,
        status: formData.status,
        estimated_cost: validation.values.estimatedCost,
        actual_cost: validation.values.actualCost,
        notes: emptyToNull(formData.notes),
      };

      const { error } = await supabase
        .from("repair_process_items")
        .insert([repairProcessItem]);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setFormData(getInitialFormData(repairProcess?.process_type));
      setSuccessMessage("Repair process item added successfully.");
      await onItemAdded();
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
              Add Repair Process Item
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {formatRepairProcessType(repairProcess?.process_type)}
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
          <label className="block" htmlFor="repair-process-item-category">
            <span className="text-sm font-medium text-zinc-700">
              Category
            </span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="repair-process-item-category"
              name="category_name"
              onChange={handleChange}
              value={formData.category_name}
            >
              {categoryOptions.map((categoryName) => (
                <option key={categoryName} value={categoryName}>
                  {categoryName}
                </option>
              ))}
            </select>
          </label>

          {isCustomCategory && (
            <label
              className="block"
              htmlFor="repair-process-item-custom-category"
            >
              <span className="text-sm font-medium text-zinc-700">
                Custom Category
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="repair-process-item-custom-category"
                name="custom_category_name"
                onChange={handleChange}
                required
                type="text"
                value={formData.custom_category_name}
              />
            </label>
          )}

          <label className="block" htmlFor="repair-process-item-status">
            <span className="text-sm font-medium text-zinc-700">Status</span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="repair-process-item-status"
              name="status"
              onChange={handleChange}
              value={formData.status}
            >
              {repairProcessItemStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label
              className="block"
              htmlFor="repair-process-item-estimated-cost"
            >
              <span className="text-sm font-medium text-zinc-700">
                Estimated Cost
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="repair-process-item-estimated-cost"
                min="0"
                name="estimated_cost"
                onChange={handleChange}
                step="0.01"
                type="number"
                value={formData.estimated_cost}
              />
            </label>

            <label className="block" htmlFor="repair-process-item-actual-cost">
              <span className="text-sm font-medium text-zinc-700">
                Actual Cost
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="repair-process-item-actual-cost"
                min="0"
                name="actual_cost"
                onChange={handleChange}
                step="0.01"
                type="number"
                value={formData.actual_cost}
              />
            </label>
          </div>

          <label className="block" htmlFor="repair-process-item-notes">
            <span className="text-sm font-medium text-zinc-700">Notes</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="repair-process-item-notes"
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
              {isSubmitting ? "Adding..." : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddRepairProcessItemForm;
