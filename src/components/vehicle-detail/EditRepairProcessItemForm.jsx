import { useState } from "react";
import {
  formatRepairProcessType,
  repairProcessItemStatusOptions,
} from "../../lib/repairProcess";
import {
  getRepairProcessItemCategoryFormData,
  getRepairProcessItemCategoryOptions,
} from "../../lib/repairProcessItemCategories";
import { supabase } from "../../lib/supabaseClient";

const allowedStatuses = repairProcessItemStatusOptions.map(
  (option) => option.value
);

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

function getSelectedCategoryName(formData) {
  if (formData.category_name === "Other") {
    return emptyToNull(formData.custom_category_name);
  }

  return emptyToNull(formData.category_name);
}

function getInitialFormData(item, processType) {
  const categoryFormData = getRepairProcessItemCategoryFormData(
    item?.category_name,
    processType
  );
  const status = allowedStatuses.includes(item?.status)
    ? item.status
    : "pending";

  return {
    ...categoryFormData,
    status,
    cost: item?.cost ?? "",
    notes: item?.notes ?? "",
  };
}

function validateForm(formData) {
  const categoryName = getSelectedCategoryName(formData);
  const cost = parseCost(formData.cost, "Cost");

  if (!categoryName) {
    return { error: "Category name is required." };
  }

  if (!allowedStatuses.includes(formData.status)) {
    return { error: "Choose a valid status." };
  }

  if (cost.error) {
    return { error: cost.error };
  }

  return {
    error: "",
    values: {
      categoryName,
      cost: cost.value,
    },
  };
}

function EditRepairProcessItemForm({
  item,
  onClose,
  onItemUpdated,
  repairProcess,
}) {
  const [formData, setFormData] = useState(() =>
    getInitialFormData(item, repairProcess?.process_type)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const categoryOptions = getRepairProcessItemCategoryOptions(
    repairProcess?.process_type
  );
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

    if (!item?.id) {
      setErrorMessage("Unable to update this item without an ID.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const validation = validateForm(formData);

      if (validation.error) {
        setErrorMessage(validation.error);
        return;
      }

      const itemUpdates = {
        category_name: validation.values.categoryName,
        status: formData.status,
        cost: validation.values.cost,
        notes: emptyToNull(formData.notes),
      };

      const { data, error } = await supabase
        .from("repair_process_items")
        .update(itemUpdates)
        .eq("id", item.id)
        .select(
          "id, repair_process_id, vehicle_id, category_name, status, cost, notes, created_at"
        )
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      await onItemUpdated(data);
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
            <h3 className="text-lg font-bold text-zinc-950">
              Edit Repair Process Item
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
          <label className="block" htmlFor="edit-repair-process-item-category">
            <span className="text-sm font-medium text-zinc-700">
              Category
            </span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="edit-repair-process-item-category"
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
              htmlFor="edit-repair-process-item-custom-category"
            >
              <span className="text-sm font-medium text-zinc-700">
                Custom Category
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="edit-repair-process-item-custom-category"
                name="custom_category_name"
                onChange={handleChange}
                required
                type="text"
                value={formData.custom_category_name}
              />
            </label>
          )}

          <label className="block" htmlFor="edit-repair-process-item-status">
            <span className="text-sm font-medium text-zinc-700">Status</span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="edit-repair-process-item-status"
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

          <label className="block" htmlFor="edit-repair-process-item-cost">
            <span className="text-sm font-medium text-zinc-700">Cost</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="edit-repair-process-item-cost"
              min="0"
              name="cost"
              onChange={handleChange}
              step="0.01"
              type="number"
              value={formData.cost}
            />
          </label>

          <label className="block" htmlFor="edit-repair-process-item-notes">
            <span className="text-sm font-medium text-zinc-700">Notes</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="edit-repair-process-item-notes"
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
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditRepairProcessItemForm;
