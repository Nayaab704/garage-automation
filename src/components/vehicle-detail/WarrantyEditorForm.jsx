import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import WarrantyPeriodFields from "./WarrantyPeriodFields";
import { supabase } from "../../lib/supabaseClient";
import {
  DEFAULT_WARRANTY_MONTHS,
  addWarrantyMonths,
  createWarrantyRecordValues,
  getTodayDateValue,
  getWarrantyDateValue,
  getWarrantyEndDate,
  getWarrantyMonths,
  getWarrantyNotes,
  getWarrantyStartDate,
  getWarrantyType,
  normalizeWarrantyMonths,
} from "../../lib/warranty";

function logWarrantySaveError(error) {
  console.error("Could not save warranty:", error);
  console.log("Warranty save error message:", error?.message ?? null);
  console.log("Warranty save error details:", error?.details ?? null);
  console.log("Warranty save error hint:", error?.hint ?? null);
  console.log("Warranty save error code:", error?.code ?? null);
}

function getWarrantySaveErrorMessage(error) {
  if (error?.code === "42501") {
    return "Your account is not allowed to manage warranties. Confirm that your profile is active and has an authorized sales role.";
  }

  if (error?.code === "23503") {
    return "The linked sale no longer exists. Refresh the Warranty Register and try again.";
  }

  if (error?.code === "23514") {
    return "Choose a warranty period from 1 to 12 months.";
  }

  return "Could not save the warranty. Please try again.";
}

function createInitialForm(warranty, defaultStartDate) {
  const startDate =
    getWarrantyStartDate(warranty) ||
    String(defaultStartDate ?? "").slice(0, 10) ||
    getTodayDateValue();
  const existingMonths = getWarrantyMonths(warranty);
  const months = existingMonths ?? DEFAULT_WARRANTY_MONTHS;

  return {
    endDate: getWarrantyEndDate(warranty) || addWarrantyMonths(startDate, months),
    hasCustomLegacyRange: Boolean(
      warranty && getWarrantyEndDate(warranty) && !existingMonths
    ),
    months,
    notes: getWarrantyNotes(warranty) ?? "",
    shouldPersistMonths: !warranty || Boolean(existingMonths),
    startDate,
    type: getWarrantyType(warranty) ?? "",
  };
}

function WarrantyEditorForm({
  defaultStartDate,
  onClose,
  onSaved,
  saleId,
  warranty = null,
}) {
  const [formData, setFormData] = useState(() =>
    createInitialForm(warranty, defaultStartDate)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function updatePeriod({ months = formData.months, startDate = formData.startDate }) {
    const normalizedMonths = normalizeWarrantyMonths(months);

    setFormData((currentFormData) => ({
      ...currentFormData,
      endDate: addWarrantyMonths(startDate, normalizedMonths),
      hasCustomLegacyRange: false,
      months: normalizedMonths,
      shouldPersistMonths: true,
      startDate,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!saleId) {
      setErrorMessage("A sale record is required before adding a warranty.");
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setErrorMessage("Choose a valid warranty start date and period.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const startDate = getWarrantyDateValue(formData.startDate);
    const endDate = getWarrantyDateValue(formData.endDate);

    if (!startDate || !endDate) {
      setErrorMessage("Choose a valid warranty start date and period.");
      setIsSubmitting(false);
      return;
    }

    const warrantyValues = createWarrantyRecordValues({
      endDate,
      months: formData.months,
      notes: formData.notes,
      persistMonths: formData.shouldPersistMonths,
      saleId,
      startDate,
      type: formData.type,
    });

    try {
      const query = warranty?.id
        ? supabase
            .from("warranties")
            .update(warrantyValues)
            .eq("id", warranty.id)
        : supabase.from("warranties").insert([warrantyValues]);
      const { data, error } = await query
        .select(
          "id,sale_id,warranty_type,start_date,end_date,terms,warranty_months,created_at"
        )
        .single();

      if (error) {
        logWarrantySaveError(error);
        setErrorMessage(getWarrantySaveErrorMessage(error));
        return;
      }

      await onSaved?.(data);
      onClose();
    } catch (error) {
      logWarrantySaveError(error);
      setErrorMessage(getWarrantySaveErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="Adjust the coverage period. The end date updates automatically."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      size="lg"
      title={warranty ? "Edit / Extend Warranty" : "Add Warranty"}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {formData.hasCustomLegacyRange && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            This legacy warranty has a custom end date. It will stay unchanged
            unless you choose a new start date or period.
          </div>
        )}

        <WarrantyPeriodFields
          endDate={formData.endDate}
          idPrefix={`warranty-editor-${warranty?.id ?? saleId}`}
          months={formData.months}
          notes={formData.notes}
          onMonthsChange={(months) => updatePeriod({ months })}
          onNotesChange={(notes) =>
            setFormData((currentFormData) => ({ ...currentFormData, notes }))
          }
          onStartDateChange={(startDate) => updatePeriod({ startDate })}
          onTypeChange={(type) =>
            setFormData((currentFormData) => ({ ...currentFormData, type }))
          }
          startDate={formData.startDate}
          type={formData.type}
        />

        <FormMessage tone="error">{errorMessage}</FormMessage>

        <FormActions
          isSubmitting={isSubmitting}
          onCancel={onClose}
          submitLabel={warranty ? "Save Warranty Extension" : "Add Warranty"}
          submittingLabel="Saving warranty..."
        />
      </form>
    </ModalShell>
  );
}

export default WarrantyEditorForm;
