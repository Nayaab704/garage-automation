import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { buttonClassNames, formControlClassNames } from "../ui/uiStyles";
import { logVehicleActivity } from "../../lib/activityLogger";
import {
  compressImageFile,
  defaultPhotoCompressionOptions,
} from "../../lib/imageCompression";
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
  const [submitStatus, setSubmitStatus] = useState("");
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
    setSubmitStatus("Compressing photo...");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const uploadFile = await compressImageFile(
        selectedFile,
        defaultPhotoCompressionOptions
      );
      setSubmitStatus("Uploading photo...");
      const photoPath = buildPhotoPath(vehicleId, workOrder.id, uploadFile.name);

      const uploadResponse = await supabase.storage
        .from("vehicle-photos")
        .upload(photoPath, uploadFile, {
          cacheControl: "3600",
          contentType: uploadFile.type,
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
          caption: photo.caption,
          work_order: getWorkOrderTitle(workOrder),
        },
      });
      onActivityLogged?.();
      await onPhotoAdded?.(insertResponse.data ?? photo);
    } catch (error) {
      console.error("Could not upload photo:", error);
      setErrorMessage("Could not upload photo.");
    } finally {
      setIsSubmitting(false);
      setSubmitStatus("");
    }
  }

  return (
    <ModalShell
      description="Take or upload a photo for this work order."
      eyebrow={getWorkOrderTitle(workOrder)}
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      title="Add Photo"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <span className={formControlClassNames.label}>Photo</span>
            <div className="mt-2">
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
                className={buttonClassNames.file}
                htmlFor="work-order-photo-file"
              >
                Take or Upload Photo
              </label>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              On phone or tablet, this can open the camera.
            </p>
            {selectedFile && (
              <p className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Selected:{" "}
                <span className="font-semibold text-slate-950">
                  {selectedFile.name}
                </span>
              </p>
            )}
          </div>

          <label className="block" htmlFor="work-order-photo-caption">
            <span className={formControlClassNames.label}>Caption</span>
            <textarea
              className={formControlClassNames.textarea}
              id="work-order-photo-caption"
              name="caption"
              onChange={handleChange}
              placeholder="Optional"
              value={formData.caption}
            />
          </label>

          <FormMessage tone="error">{errorMessage}</FormMessage>

          <FormMessage tone="success">{successMessage}</FormMessage>

          <FormActions
            isSubmitting={isSubmitting}
            onCancel={onClose}
            submitLabel="Add Photo"
            submittingLabel={submitStatus || "Uploading..."}
          />
        </form>
    </ModalShell>
  );
}

export default AddWorkOrderPhotoForm;
