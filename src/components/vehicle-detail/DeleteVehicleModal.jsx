import { useState } from "react";
import AppIcon from "../ui/AppIcon";
import FormMessage from "../ui/FormMessage";
import { buttonClassNames, formControlClassNames } from "../ui/uiStyles";
import { deleteVehicleCascade } from "../../lib/deleteVehicle";

function getStoragePaths(records, pathKey) {
  return records
    .map((record) => record?.[pathKey])
    .filter((path) => path !== null && path !== undefined && path !== "");
}

function DeleteVehicleModal({
  onClose,
  onDeleted,
  vehicle,
  vehicleDocuments = [],
  vehiclePhotos = [],
}) {
  const [confirmationText, setConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const stockNumber = vehicle?.stock_number || "DELETE";
  const canConfirm = confirmationText.trim() === stockNumber;

  async function handleDelete() {
    if (!vehicle?.id || !canConfirm || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage("");
    setSuccessMessage("");
    setStorageWarning("");

    const result = await deleteVehicleCascade({
      documentPaths: getStoragePaths(vehicleDocuments, "file_path"),
      photoPaths: getStoragePaths(vehiclePhotos, "photo_path"),
      vehicleId: vehicle.id,
    });

    if (result.error) {
      console.error("Could not delete vehicle:", result.error);
      setErrorMessage("Could not delete vehicle. Please try again.");
      setIsDeleting(false);
      return;
    }

    setStorageWarning(result.storageWarning);
    setSuccessMessage(`${stockNumber} was permanently deleted.`);

    window.setTimeout(() => {
      onDeleted?.(result.data);
    }, result.storageWarning ? 1800 : 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center">
      <section className="w-full max-w-lg rounded-3xl border border-red-100 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700">
            <AppIcon name="warning" size={24} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-black text-slate-950">
              Delete {stockNumber}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This will permanently delete the vehicle and all related work
              orders, parts, labor, photos, documents, costs, and records. This
              cannot be undone.
            </p>
          </div>
        </div>

        <label className="mt-5 block" htmlFor="delete-vehicle-confirmation">
          <span className="text-sm font-bold text-slate-700">
            Type {stockNumber} to confirm
          </span>
          <input
            className={`${formControlClassNames.input} font-mono focus:border-red-300 focus:ring-red-100`}
            disabled={isDeleting || Boolean(successMessage)}
            id="delete-vehicle-confirmation"
            onChange={(event) => setConfirmationText(event.target.value)}
            value={confirmationText}
          />
        </label>

        {(errorMessage || successMessage || storageWarning) && (
          <div className="mt-4 space-y-3">
            <FormMessage tone="error">{errorMessage}</FormMessage>

            <FormMessage tone="success">{successMessage}</FormMessage>

            <FormMessage tone="warning">{storageWarning}</FormMessage>
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            className={buttonClassNames.secondary}
            disabled={isDeleting || Boolean(successMessage)}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className={buttonClassNames.danger}
            disabled={!canConfirm || isDeleting || Boolean(successMessage)}
            onClick={handleDelete}
            type="button"
          >
            {isDeleting ? "Deleting..." : "Permanently Delete"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default DeleteVehicleModal;
