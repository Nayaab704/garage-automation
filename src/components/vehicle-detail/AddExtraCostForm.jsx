import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const costTypeOptions = [
  { label: "Auction Fee", value: "auction_fee" },
  { label: "Towing", value: "towing" },
  { label: "Detailing", value: "detailing" },
  { label: "Paint Material", value: "paint_material" },
  { label: "Title Fee", value: "title_fee" },
  { label: "Misc", value: "misc" },
];

const emptyForm = {
  cost_type: "auction_fee",
  amount: "",
  description: "",
};

function emptyToNull(value) {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function parseAmount(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return { error: "Amount must be greater than 0.", value: null };
  }

  return { error: "", value: numberValue };
}

function AddExtraCostForm({ onClose, onExtraCostAdded, vehicleId }) {
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

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const amount = parseAmount(formData.amount);

      if (amount.error) {
        setErrorMessage(amount.error);
        return;
      }

      const costEntry = {
        vehicle_id: vehicleId,
        cost_type: formData.cost_type,
        amount: amount.value,
        description: emptyToNull(formData.description),
      };

      const { error } = await supabase.from("cost_entries").insert([costEntry]);

      if (error) {
        setErrorMessage(error.message);
      } else {
        setFormData(emptyForm);
        setSuccessMessage("Extra cost added successfully.");
        await onExtraCostAdded();
      }
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6">
      <div className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-950">
              Add Extra Cost
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Record a vehicle cost outside parts and labor.
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
            <label className="block" htmlFor="extra-cost-type">
              <span className="text-sm font-medium text-zinc-700">
                Cost Type
              </span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="extra-cost-type"
                name="cost_type"
                onChange={handleChange}
                value={formData.cost_type}
              >
                {costTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block" htmlFor="extra-cost-amount">
              <span className="text-sm font-medium text-zinc-700">
                Amount
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="extra-cost-amount"
                min="0.01"
                name="amount"
                onChange={handleChange}
                required
                step="0.01"
                type="number"
                value={formData.amount}
              />
            </label>
          </div>

          <label className="block" htmlFor="extra-cost-description">
            <span className="text-sm font-medium text-zinc-700">
              Description
            </span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="extra-cost-description"
              name="description"
              onChange={handleChange}
              value={formData.description}
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
              {isSubmitting ? "Adding..." : "Add Extra Cost"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddExtraCostForm;
