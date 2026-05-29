import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";

const emptyForm = {
  part_name: "",
  quantity: "1",
  part_source: "in_house",
  unit_cost: "",
  notes: "",
};

const partSourceOptions = [
  { value: "in_house", label: "In-house / Available" },
  { value: "needs_to_buy", label: "Needs to Buy" },
];

const allowedPartSources = partSourceOptions.map((option) => option.value);

function emptyToNull(value) {
  const trimmedValue = String(value ?? "").trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function getValidPartSource(value) {
  return allowedPartSources.includes(value) ? value : "in_house";
}

function getPartApprovalValues(partSource) {
  if (partSource === "needs_to_buy") {
    return {
      approval_status: "pending",
      status: "requested",
    };
  }

  return {
    approval_status: "not_required",
    status: "received",
  };
}

function getWorkOrderTitle(workOrder) {
  return workOrder?.title || workOrder?.name || "Work Order";
}

function AddWorkOrderPartForm({
  currentProfile,
  onActivityLogged,
  onClose,
  onPartAdded,
  vehicleId,
  workOrder,
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

    const partName = emptyToNull(formData.part_name);
    const quantity = Number(formData.quantity || 1);
    const unitCost = Number(formData.unit_cost || 0);
    const partSource = getValidPartSource(formData.part_source);
    const approvalValues = getPartApprovalValues(partSource);

    if (!partName) {
      setErrorMessage("Part name is required.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity < 1) {
      setErrorMessage("Quantity must be at least 1.");
      return;
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setErrorMessage("Unit cost must be 0 or greater.");
      return;
    }

    if (!vehicleId || !workOrder?.id) {
      setErrorMessage("Unable to add a part without a work order.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const partRequest = {
        vehicle_id: vehicleId,
        repair_job_id: workOrder.id,
        part_name: partName,
        quantity,
        part_source: partSource,
        unit_cost: unitCost,
        notes: emptyToNull(formData.notes),
        created_by: currentProfile?.id ?? null,
        ...approvalValues,
      };

      const { data, error } = await supabase
        .from("part_requests")
        .insert([partRequest])
        .select("*")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setFormData(emptyForm);
      setSuccessMessage("Part added successfully.");
      await logVehicleActivity({
        vehicleId,
        action: "Part request created",
        details: {
          part_name: partRequest.part_name,
          quantity: partRequest.quantity,
          part_source: partRequest.part_source,
          work_order: getWorkOrderTitle(workOrder),
        },
      });
      onActivityLogged?.();
      await onPartAdded?.(data ?? partRequest);
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {getWorkOrderTitle(workOrder)}
            </p>
            <h3 className="mt-1 text-lg font-bold text-zinc-950">Add Part</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Add a required part directly to this work order.
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
          <label className="block" htmlFor="work-order-part-name">
            <span className="text-sm font-medium text-zinc-700">
              Part Name
            </span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="work-order-part-name"
              name="part_name"
              onChange={handleChange}
              required
              type="text"
              value={formData.part_name}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block" htmlFor="work-order-part-quantity">
              <span className="text-sm font-medium text-zinc-700">
                Quantity
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="work-order-part-quantity"
                min="1"
                name="quantity"
                onChange={handleChange}
                step="1"
                type="number"
                value={formData.quantity}
              />
            </label>

            <label className="block sm:col-span-2" htmlFor="work-order-part-source">
              <span className="text-sm font-medium text-zinc-700">
                Part Source
              </span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="work-order-part-source"
                name="part_source"
                onChange={handleChange}
                value={formData.part_source}
              >
                {partSourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block" htmlFor="work-order-part-unit-cost">
            <span className="text-sm font-medium text-zinc-700">
              Unit Cost
            </span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="work-order-part-unit-cost"
              min="0"
              name="unit_cost"
              onChange={handleChange}
              step="0.01"
              type="number"
              value={formData.unit_cost}
            />
          </label>

          <label className="block" htmlFor="work-order-part-notes">
            <span className="text-sm font-medium text-zinc-700">Notes</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="work-order-part-notes"
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
              {isSubmitting ? "Adding..." : "Add Part"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddWorkOrderPartForm;
