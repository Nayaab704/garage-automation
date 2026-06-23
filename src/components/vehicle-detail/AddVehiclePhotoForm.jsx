import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { formControlClassNames } from "../ui/uiStyles";
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

    if (isSubmitting) {
      return;
    }

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
        console.error("Could not upload photo:", uploadResponse.error);
        setErrorMessage("Could not upload photo.");
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
        .insert([photo])
        .select("*")
        .single();

      if (insertResponse.error) {
        await cleanupUploadedFile(photoPath);
        console.error("Could not upload photo:", insertResponse.error);
        setErrorMessage("Could not upload photo.");
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
      await onPhotoAdded(insertResponse.data ?? photo);
    } catch (error) {
      console.error("Could not upload photo:", error);
      setErrorMessage("Could not upload photo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="Add a vehicle image to the photo gallery."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      title="Upload Photo"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block" htmlFor="vehicle-photo-file">
            <span className={formControlClassNames.label}>Image</span>
            <input
              accept="image/*"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-black file:text-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              id="vehicle-photo-file"
              key={fileInputKey}
              onChange={handleFileChange}
              required
              type="file"
            />
          </label>

          <label className="block" htmlFor="vehicle-photo-type">
            <span className={formControlClassNames.label}>Photo Type</span>
            <select
              className={formControlClassNames.select}
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
            <span className={formControlClassNames.label}>Caption</span>
            <textarea
              className={formControlClassNames.textarea}
              id="vehicle-photo-caption"
              name="caption"
              onChange={handleChange}
              value={formData.caption}
            />
          </label>

          <FormMessage tone="error">{errorMessage}</FormMessage>

          <FormMessage tone="success">{successMessage}</FormMessage>

          <FormActions
            isSubmitting={isSubmitting}
            onCancel={onClose}
            submitLabel="Upload Photo"
            submittingLabel="Uploading..."
          />
        </form>
    </ModalShell>
  );
}

export default AddVehiclePhotoForm;
