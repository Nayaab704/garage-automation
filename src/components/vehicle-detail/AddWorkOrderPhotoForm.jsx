import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";

const emptyForm = {
  caption: "",
};

function emptyToNull(value) {
  const trimmedValue = String(value ?? "").trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function cleanFileName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-");
}

function getWorkOrderTitle(workOrder) {
  return workOrder?.title || workOrder?.name || "Work Order";
}

function buildPhotoPath(vehicleId, repairJobId, fileName) {
  const timestamp = Date.now();
  return `vehicles/${vehicleId}/work-orders/${repairJobId}/${timestamp}-${cleanFileName(
    fileName
  )}`;
}

function AddWorkOrderPhotoForm({
  onActivityLogged,
  onClose,
  onPhotoAdded,
  vehicleId,
  workOrder,
}) {
  const [formData, setFormData] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
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

  function handleFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  async function cleanupUploadedFile(photoPath) {
    await supabase.storage.from("vehicle-photos").remove([photoPath]);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!vehicleId || !workOrder?.id) {
      setErrorMessage("Unable to upload a photo without a work order.");
      return;
    }

    if (!selectedFile) {
      setErrorMessage("Choose an image before uploading.");
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      setErrorMessage("Please choose an image file.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const photoPath = buildPhotoPath(vehicleId, workOrder.id, selectedFile.name);

    try {
      const uploadResponse = await supabase.storage
        .from("vehicle-photos")
        .upload(photoPath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadResponse.error) {
        setErrorMessage(uploadResponse.error.message);
        return;
      }

      const publicUrlResponse = supabase.storage
        .from("vehicle-photos")
        .getPublicUrl(photoPath);
      const photoUrl = publicUrlResponse.data.publicUrl;

      const photo = {
        vehicle_id: vehicleId,
        repair_job_id: workOrder.id,
        photo_url: photoUrl,
        photo_path: photoPath,
        caption: emptyToNull(formData.caption),
        photo_type: "general",
      };

      const insertResponse = await supabase
        .from("vehicle_photos")
        .insert([photo])
        .select("*")
        .single();

      if (insertResponse.error) {
        await cleanupUploadedFile(photoPath);
        setErrorMessage(insertResponse.error.message);
        return;
      }

      setFormData(emptyForm);
      setSelectedFile(null);
      setFileInputKey((currentKey) => currentKey + 1);
      setSuccessMessage("Photo uploaded successfully.");
      await logVehicleActivity({
        vehicleId,
        action: "Photo uploaded",
        details: {
          caption: photo.caption,
          work_order: getWorkOrderTitle(workOrder),
        },
      });
      onActivityLogged?.();
      await onPhotoAdded?.(insertResponse.data ?? photo);
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {getWorkOrderTitle(workOrder)}
            </p>
            <h3 className="mt-1 text-lg font-bold text-zinc-950">
              Add Photo
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Take or upload a photo for this work order.
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
          <div>
            <span className="text-sm font-medium text-zinc-700">Photo</span>
            <div className="mt-1">
              <input
                accept="image/*"
                capture="environment"
                className="sr-only"
                id="work-order-photo-file"
                key={fileInputKey}
                onChange={handleFileChange}
                type="file"
              />
              <label
                className="inline-flex cursor-pointer rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus-within:ring-2 focus-within:ring-zinc-200"
                htmlFor="work-order-photo-file"
              >
                Take or Upload Photo
              </label>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              On phone or tablet, this can open the camera.
            </p>
            {selectedFile && (
              <p className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                Selected:{" "}
                <span className="font-semibold text-zinc-950">
                  {selectedFile.name}
                </span>
              </p>
            )}
          </div>

          <label className="block" htmlFor="work-order-photo-caption">
            <span className="text-sm font-medium text-zinc-700">
              Caption
            </span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="work-order-photo-caption"
              name="caption"
              onChange={handleChange}
              placeholder="Optional"
              value={formData.caption}
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
              {isSubmitting ? "Uploading..." : "Add Photo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddWorkOrderPhotoForm;
