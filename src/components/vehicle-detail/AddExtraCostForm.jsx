import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { formControlClassNames } from "../ui/uiStyles";
import { logVehicleActivity } from "../../lib/activityLogger";
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

function AddExtraCostForm({
  onActivityLogged,
  onClose,
  onExtraCostAdded,
  vehicleId,
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
        await logVehicleActivity({
          vehicleId,
          action: "Extra cost added",
          details: {
            amount: costEntry.amount,
            cost_type: costEntry.cost_type,
            description: costEntry.description,
          },
        });
        onActivityLogged?.();
        await onExtraCostAdded();
      }
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="Record a vehicle cost outside parts and labor."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      title="Add Extra Cost"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="extra-cost-type">
              <span className={formControlClassNames.label}>Cost Type</span>
              <select
                className={formControlClassNames.select}
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
              <span className={formControlClassNames.label}>Amount</span>
              <input
                className={formControlClassNames.input}
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
            <span className={formControlClassNames.label}>Description</span>
            <textarea
              className={formControlClassNames.textarea}
              id="extra-cost-description"
              name="description"
              onChange={handleChange}
              value={formData.description}
            />
          </label>

          <FormMessage tone="error">{errorMessage}</FormMessage>

          <FormMessage tone="success">{successMessage}</FormMessage>

          <FormActions
            isSubmitting={isSubmitting}
            onCancel={onClose}
            submitLabel="Add Extra Cost"
            submittingLabel="Adding..."
          />
        </form>
    </ModalShell>
  );
}

export default AddExtraCostForm;
