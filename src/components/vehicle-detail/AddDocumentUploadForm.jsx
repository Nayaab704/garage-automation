import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { buttonClassNames, formControlClassNames } from "../ui/uiStyles";
import { logVehicleActivity } from "../../lib/activityLogger";
import {
  compressImageFile,
  documentImageCompressionOptions,
  isImageFile,
} from "../../lib/imageCompression";
import { supabase } from "../../lib/supabaseClient";

const documentTypeLabels = {
  purchase_receipt: "Purchase Receipt",
  third_party_invoice: "Third-Party Invoice",
};

const emptyForm = {
  notes: "",
};

const maxDocumentFileSizeBytes = 5 * 1024 * 1024;
const largeDocumentMessage =
  "This file is too large. Please upload a file under 5 MB.";
const documentUploadAccept = [
  "image/*",
  "application/pdf",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".rtf",
  "text/csv",
  "text/plain",
  "application/msword",
  "application/rtf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");
const allowedDocumentMimeTypes = new Set([
  "application/csv",
  "application/msword",
  "application/pdf",
  "application/rtf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "text/plain",
]);
const allowedDocumentExtensions = new Set([
  "csv",
  "doc",
  "docx",
  "pdf",
  "rtf",
  "txt",
  "xls",
  "xlsx",
]);

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

function getFileExtension(file) {
  return String(file?.name ?? "")
    .split(".")
    .pop()
    .toLowerCase();
}

function isAllowedFile(file) {
  if (!file) {
    return false;
  }

  if (isImageFile(file)) {
    return true;
  }

  return (
    allowedDocumentMimeTypes.has(String(file.type ?? "").toLowerCase()) ||
    allowedDocumentExtensions.has(getFileExtension(file))
  );
}

function isOversizedDocumentFile(file) {
  return Boolean(
    file && !isImageFile(file) && file.size > maxDocumentFileSizeBytes
  );
}

function AddDocumentUploadForm({
  currentProfile,
  description = "Upload a document or image.",
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

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isAllowedFile(file)) {
      setSelectedFile(null);
      setErrorMessage("Please choose a document or image file.");
      event.target.value = "";
      return;
    }

    if (isOversizedDocumentFile(file)) {
      setSelectedFile(null);
      setErrorMessage(largeDocumentMessage);
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setErrorMessage("");
  }

  async function cleanupUploadedFile(filePath) {
    await supabase.storage.from("vehicle-documents").remove([filePath]);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!vehicleId) {
      setErrorMessage("Unable to upload a document without a vehicle.");
      return;
    }

    if (!selectedFile) {
      setErrorMessage("Choose a document or image before uploading.");
      return;
    }

    if (!isAllowedFile(selectedFile)) {
      setErrorMessage("Please choose a document or image file.");
      return;
    }

    if (isOversizedDocumentFile(selectedFile)) {
      setErrorMessage(largeDocumentMessage);
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(isImageFile(selectedFile) ? "Compressing image..." : "Uploading document...");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const uploadFile = isImageFile(selectedFile)
        ? await compressImageFile(selectedFile, documentImageCompressionOptions)
        : selectedFile;
      setSubmitStatus("Uploading document...");
      const filePath = buildDocumentPath(vehicleId, uploadFile.name);

      const uploadResponse = await supabase.storage
        .from("vehicle-documents")
        .upload(filePath, uploadFile, {
          cacheControl: "3600",
          contentType: uploadFile.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadResponse.error) {
        console.error("Could not upload document:", uploadResponse.error);
        setErrorMessage("Could not upload document. Please try again.");
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
        file_name: uploadFile.name,
        file_mime_type: uploadFile.type || "application/octet-stream",
        file_size_bytes: uploadFile.size ?? 0,
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
        console.error("Could not save document:", insertResponse.error);
        setErrorMessage("Could not upload document. Please try again.");
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
          file_name: uploadFile.name,
        },
      });
      onActivityLogged?.();
      await onDocumentAdded?.(insertResponse.data ?? documentRecord);
    } catch (error) {
      console.error("Could not upload document:", error);
      setErrorMessage("Could not upload document. Please try again.");
    } finally {
      setIsSubmitting(false);
      setSubmitStatus("");
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
              Document or Image
            </span>
            <div className="mt-2">
              <input
                accept={documentUploadAccept}
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
                Choose Document or Image
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
            submittingLabel={submitStatus || "Uploading..."}
          />
        </form>
    </ModalShell>
  );
}

export default AddDocumentUploadForm;
