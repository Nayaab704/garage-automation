import { buttonClassNames } from "./uiStyles";

function FormActions({
  cancelLabel = "Cancel",
  isSubmitting = false,
  onCancel,
  submitDisabled = false,
  submitLabel,
  submittingLabel = "Saving...",
  submitVariant = "primary",
}) {
  const submitClassName =
    submitVariant === "danger"
      ? buttonClassNames.danger
      : buttonClassNames.primary;

  return (
    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
      {onCancel && (
        <button
          className={`w-full sm:w-auto ${buttonClassNames.secondary}`}
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
        >
          {cancelLabel}
        </button>
      )}

      <button
        className={`w-full sm:w-auto ${submitClassName}`}
        disabled={submitDisabled || isSubmitting}
        type="submit"
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </div>
  );
}

export default FormActions;
