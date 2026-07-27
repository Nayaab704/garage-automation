import { useState } from "react";
import { archiveExpiredWarrantyVehicle } from "../lib/expiredWarrantyArchive";
import AppIcon from "./ui/AppIcon";
import FormMessage from "./ui/FormMessage";
import ModalShell from "./ui/ModalShell";
import { buttonClassNames } from "./ui/uiStyles";

function ExpiredWarrantyArchiveModal({ onArchived, onClose, record }) {
  const [hasExported, setHasExported] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleArchive(event) {
    event.preventDefault();

    if (!hasExported || isSubmitting || !record?.vehicleId) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const result = await archiveExpiredWarrantyVehicle({
        vehicleId: record.vehicleId,
        warrantyEndDate: record.endDate,
        warrantyId: record.warranty?.id,
      });

      if (result.error) {
        setErrorMessage(result.error.message);
        return;
      }

      onArchived?.(result);
    } catch (error) {
      console.error("Could not archive expired warranty vehicle:", error);
      setErrorMessage(
        "Could not archive and delete the vehicle. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="This will remove the vehicle and related app records from active use. Main vehicle details, warranty dates, sale/customer summary, and financial summary should be exported before deleting. Photos and repair records may be permanently removed."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      size="sm"
      title="Archive and delete this vehicle?"
    >
      <form className="space-y-4" onSubmit={handleArchive}>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
          <div className="flex items-start gap-3">
            <AppIcon
              className="mt-0.5 shrink-0 text-red-700"
              name="warning"
              size={20}
            />
            <div className="min-w-0">
              <p className="font-black text-red-950">
                {record?.vehicleTitle || "Expired warranty vehicle"}
              </p>
              <p className="mt-1 break-words text-xs font-semibold text-red-800">
                {[record?.vehicle?.stock_number, record?.vehicle?.vin]
                  .filter(Boolean)
                  .join(" · ") || "Stock and VIN not recorded"}
              </p>
            </div>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3">
          <input
            checked={hasExported}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
            disabled={isSubmitting}
            onChange={(event) => setHasExported(event.target.checked)}
            type="checkbox"
          />
          <span className="text-sm font-bold leading-5 text-slate-800">
            I have downloaded/exported this vehicle record.
          </span>
        </label>

        <FormMessage tone="error">{errorMessage}</FormMessage>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            className={buttonClassNames.secondary}
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className={buttonClassNames.danger}
            disabled={!hasExported || isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Archiving..." : "Archive & Delete"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export default ExpiredWarrantyArchiveModal;
