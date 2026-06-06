import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { buttonClassNames, formControlClassNames } from "../ui/uiStyles";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";

const documentTypeLabels = {
  purchase_receipt: "Purchase Receipt",
  third_party_invoice: "Third-Party Invoice",
};

const emptyForm = {
  notes: "",
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

function buildDocumentPath(vehicleId, fileName) {
  const timestamp = Date.now();
  return `vehicles/${vehicleId}/documents/${timestamp}-${cleanFileName(
    fileName
  )}`;
}

function getDocumentTypeLabel(documentType) {
  return documentTypeLabels[documentType] ?? "Document";
}

function isAllowedFile(file) {
  return file?.type === "application/pdf" || file?.type?.startsWith("image/");
}

function AddDocumentUploadForm({
  currentProfile,
  description = "Upload a PDF or image document.",
  documentType,
  onActivityLogged,
  onClose,
  onDocumentAdded,
  purchaseOrderId = null,
  repairJobId = null,
  thirdPartyRepairId = null,
  title = "Upload Document",
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

  async function cleanupUploadedFile(filePath) {
    await supabase.storage.from("vehicle-documents").remove([filePath]);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!vehicleId) {
      setErrorMessage("Unable to upload a document without a vehicle.");
      return;
    }

    if (!selectedFile) {
      setErrorMessage("Choose a PDF or image before uploading.");
      return;
    }

    if (!isAllowedFile(selectedFile)) {
      setErrorMessage("Please choose a PDF or image file.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const filePath = buildDocumentPath(vehicleId, selectedFile.name);

    try {
      const uploadResponse = await supabase.storage
        .from("vehicle-documents")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadResponse.error) {
        setErrorMessage(uploadResponse.error.message);
        return;
      }

      const publicUrlResponse = supabase.storage
        .from("vehicle-documents")
        .getPublicUrl(filePath);
      const fileUrl = publicUrlResponse.data.publicUrl;

      const documentRecord = {
        vehicle_id: vehicleId,
        repair_job_id: repairJobId,
        third_party_repair_id: thirdPartyRepairId,
        purchase_order_id: purchaseOrderId,
        document_type: documentType,
        file_url: fileUrl,
        file_path: filePath,
        file_name: selectedFile.name,
        file_mime_type: selectedFile.type || "application/octet-stream",
        file_size_bytes: selectedFile.size ?? 0,
        notes: emptyToNull(formData.notes),
        uploaded_by: currentProfile?.id ?? null,
      };

      const insertResponse = await supabase
        .from("vehicle_documents")
        .insert([documentRecord])
        .select("*")
        .single();

      if (insertResponse.error) {
        await cleanupUploadedFile(filePath);
        setErrorMessage(insertResponse.error.message);
        return;
      }

      setFormData(emptyForm);
      setSelectedFile(null);
      setFileInputKey((currentKey) => currentKey + 1);
      setSuccessMessage("Document uploaded successfully.");
      await logVehicleActivity({
        vehicleId,
        action: "Document uploaded",
        details: {
          document_type: getDocumentTypeLabel(documentType),
          file_name: selectedFile.name,
        },
      });
      onActivityLogged?.();
      await onDocumentAdded?.(insertResponse.data ?? documentRecord);
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description={description}
      eyebrow={getDocumentTypeLabel(documentType)}
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      title={title}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <span className={formControlClassNames.label}>
              PDF or Image
            </span>
            <div className="mt-2">
              <input
                accept="application/pdf,image/*"
                className="sr-only"
                id="document-upload-file"
                key={fileInputKey}
                onChange={handleFileChange}
                type="file"
              />
              <label
                className={buttonClassNames.file}
                htmlFor="document-upload-file"
              >
                Choose PDF or Image
              </label>
            </div>
            {selectedFile && (
              <p className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Selected:{" "}
                <span className="font-semibold text-slate-950">
                  {selectedFile.name}
                </span>
              </p>
            )}
          </div>

          <label className="block" htmlFor="document-upload-notes">
            <span className={formControlClassNames.label}>Notes</span>
            <textarea
              className={formControlClassNames.textarea}
              id="document-upload-notes"
              name="notes"
              onChange={handleChange}
              placeholder="Optional"
              value={formData.notes}
            />
          </label>

          <FormMessage tone="error">{errorMessage}</FormMessage>

          <FormMessage tone="success">{successMessage}</FormMessage>

          <FormActions
            isSubmitting={isSubmitting}
            onCancel={onClose}
            submitLabel="Upload Document"
            submittingLabel="Uploading..."
          />
        </form>
    </ModalShell>
  );
}

export default AddDocumentUploadForm;
