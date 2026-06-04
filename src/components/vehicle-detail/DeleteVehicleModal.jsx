import { useState } from "react";
import AppIcon from "../ui/AppIcon";
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
      setErrorMessage(result.error.message);
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
            className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 font-mono text-slate-950 shadow-sm outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
            disabled={isDeleting || Boolean(successMessage)}
            id="delete-vehicle-confirmation"
            onChange={(event) => setConfirmationText(event.target.value)}
            value={confirmationText}
          />
        </label>

        {errorMessage && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {successMessage}
          </div>
        )}

        {storageWarning && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {storageWarning}
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDeleting || Boolean(successMessage)}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="min-h-11 rounded-2xl bg-red-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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
