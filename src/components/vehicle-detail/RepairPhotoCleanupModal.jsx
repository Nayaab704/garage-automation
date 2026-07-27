import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";

function RepairPhotoCleanupModal({
  candidateCount,
  onClose,
  onConfirm,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const summary = await onConfirm?.();

      if (!summary || summary.error || summary.failedCount > 0) {
        setErrorMessage(
          "Vehicle is Ready for Sale, but photo cleanup needs review."
        );
        return;
      }

      onClose();
    } catch (error) {
      console.error("Could not clean repair photos:", error);
      setErrorMessage(
        "Vehicle is Ready for Sale, but photo cleanup needs review."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="This will delete repair/before/work-order photos only. Main, final, documents, invoices, and receipts will be kept."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      size="sm"
      title="Clean Repair Photos"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          {candidateCount}{" "}
          {candidateCount === 1 ? "photo appears" : "photos appear"} safe to
          remove.
        </p>

        <FormMessage tone="error">{errorMessage}</FormMessage>

        <FormActions
          isSubmitting={isSubmitting}
          onCancel={onClose}
          submitLabel="Clean Repair Photos"
          submittingLabel="Cleaning photos..."
          submitVariant="danger"
        />
      </form>
    </ModalShell>
  );
}

export default RepairPhotoCleanupModal;
