import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import WarrantyPeriodFields from "./WarrantyPeriodFields";
import {
  DEFAULT_WARRANTY_MONTHS,
  addWarrantyMonths,
  getTodayDateValue,
  getWarrantyDateValue,
  getWarrantyEndDate,
  getWarrantyMonths,
  getWarrantyNotes,
  getWarrantyStartDate,
  getWarrantyType,
  normalizeWarrantyMonths,
} from "../../lib/warranty";
import {
  getWarrantyPersistenceErrorMessage,
  logWarrantyPersistenceError,
  saveWarrantyForSale,
} from "../../lib/warrantyPersistence";

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

    try {
      const { data, error } = await saveWarrantyForSale({
        context: "Could not save warranty from the warranty editor",
        endDate,
        months: formData.months,
        notes: formData.notes,
        persistMonths: formData.shouldPersistMonths,
        saleId,
        startDate,
        type: formData.type,
        warrantyId: warranty?.id,
      });

      if (error) {
        setErrorMessage(getWarrantyPersistenceErrorMessage(error));
        return;
      }

      onClose();

      try {
        await onSaved?.(data);
      } catch (refreshError) {
        logWarrantyPersistenceError(
          "Warranty saved, but the page could not refresh",
          refreshError
        );
      }
    } catch (error) {
      logWarrantyPersistenceError(
        "Could not save warranty from the warranty editor",
        error
      );
      setErrorMessage(getWarrantyPersistenceErrorMessage(error));
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
