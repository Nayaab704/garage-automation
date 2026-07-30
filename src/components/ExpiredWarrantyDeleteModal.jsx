import { useState } from "react";
import { deleteExpiredWarrantyVehicle } from "../lib/expiredWarrantyDelete";
import AppIcon from "./ui/AppIcon";
import FormMessage from "./ui/FormMessage";
import ModalShell from "./ui/ModalShell";
import { buttonClassNames } from "./ui/uiStyles";

function ExpiredWarrantyDeleteModal({ onClose, onDeleted, record }) {
  const [hasSavedArchive, setHasSavedArchive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleDelete(event) {
    event.preventDefault();

    if (!hasSavedArchive || isSubmitting || !record?.vehicleId) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const result = await deleteExpiredWarrantyVehicle({
        archiveRecord: record,
        saleId: record.sale?.id,
        vehicleId: record.vehicleId,
        warrantyEndDate: record.endDate,
        warrantyId: record.warranty?.id,
      });

      if (result.error) {
        setErrorMessage(result.error.message);
        return;
      }

      onDeleted?.(result);
    } catch (error) {
      console.error("Could not delete expired warranty vehicle:", error);
      setErrorMessage(
        "Could not delete the vehicle. Refresh the cleanup list and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="Save this vehicle in the archive CSV first. Deleting permanently removes the vehicle, related records, and photos from the app."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      size="sm"
      title="Delete expired vehicle from app?"
    >
      <form className="space-y-4" onSubmit={handleDelete}>
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
            checked={hasSavedArchive}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
            disabled={isSubmitting}
            onChange={(event) => setHasSavedArchive(event.target.checked)}
            type="checkbox"
          />
          <span className="text-sm font-bold leading-5 text-slate-800">
            I downloaded and saved the archive CSV.
          </span>
        </label>

        <FormMessage tone="error">{errorMessage}</FormMessage>

        <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
          <button
            className={buttonClassNames.secondary}
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            aria-busy={isSubmitting}
            className={buttonClassNames.danger}
            disabled={!hasSavedArchive || isSubmitting}
            type="submit"
          >
            {isSubmitting && (
              <AppIcon className="animate-spin" name="refresh" size={18} />
            )}
            Delete From App
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export default ExpiredWarrantyDeleteModal;
