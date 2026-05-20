import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";

const photoTypeOptions = [
  { label: "General", value: "general" },
  { label: "Damage", value: "damage" },
  { label: "Before", value: "before" },
  { label: "After", value: "after" },
  { label: "Document", value: "document" },
];

const emptyForm = {
  photo_type: "general",
  caption: "",
};

function emptyToNull(value) {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function cleanFileName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-");
}

function buildPhotoPath(vehicleId, fileName) {
  const timestamp = Date.now();
  return `vehicles/${vehicleId}/${timestamp}-${cleanFileName(fileName)}`;
}

function AddVehiclePhotoForm({
  onActivityLogged,
  onClose,
  onPhotoAdded,
  vehicleId,
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

    if (!vehicleId) {
      setErrorMessage("Unable to upload a photo without a vehicle.");
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

    const photoPath = buildPhotoPath(vehicleId, selectedFile.name);

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
        photo_url: photoUrl,
        photo_path: photoPath,
        photo_type: formData.photo_type,
        caption: emptyToNull(formData.caption),
      };

      const insertResponse = await supabase
        .from("vehicle_photos")
        .insert([photo]);

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
          photo_type: photo.photo_type,
          caption: photo.caption,
          file_name: selectedFile.name,
        },
      });
      onActivityLogged?.();
      await onPhotoAdded();
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6">
      <div className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-950">Upload Photo</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Add a vehicle image to the photo gallery.
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
          <label className="block" htmlFor="vehicle-photo-file">
            <span className="text-sm font-medium text-zinc-700">Image</span>
            <input
              accept="image/*"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 shadow-sm outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-zinc-950 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="vehicle-photo-file"
              key={fileInputKey}
              onChange={handleFileChange}
              required
              type="file"
            />
          </label>

          <label className="block" htmlFor="vehicle-photo-type">
            <span className="text-sm font-medium text-zinc-700">
              Photo Type
            </span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="vehicle-photo-type"
              name="photo_type"
              onChange={handleChange}
              value={formData.photo_type}
            >
              {photoTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block" htmlFor="vehicle-photo-caption">
            <span className="text-sm font-medium text-zinc-700">Caption</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="vehicle-photo-caption"
              name="caption"
              onChange={handleChange}
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
              {isSubmitting ? "Uploading..." : "Upload Photo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddVehiclePhotoForm;
