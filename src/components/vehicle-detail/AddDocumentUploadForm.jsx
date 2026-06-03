import { useState } from "react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {getDocumentTypeLabel(documentType)}
            </p>
            <h3 className="mt-1 text-lg font-bold text-zinc-950">{title}</h3>
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
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
            <span className="text-sm font-medium text-zinc-700">
              PDF or Image
            </span>
            <div className="mt-1">
              <input
                accept="application/pdf,image/*"
                className="sr-only"
                id="document-upload-file"
                key={fileInputKey}
                onChange={handleFileChange}
                type="file"
              />
              <label
                className="inline-flex cursor-pointer rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus-within:ring-2 focus-within:ring-zinc-200"
                htmlFor="document-upload-file"
              >
                Choose PDF or Image
              </label>
            </div>
            {selectedFile && (
              <p className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                Selected:{" "}
                <span className="font-semibold text-zinc-950">
                  {selectedFile.name}
                </span>
              </p>
            )}
          </div>

          <label className="block" htmlFor="document-upload-notes">
            <span className="text-sm font-medium text-zinc-700">Notes</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="document-upload-notes"
              name="notes"
              onChange={handleChange}
              placeholder="Optional"
              value={formData.notes}
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
              {isSubmitting ? "Uploading..." : "Upload Document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddDocumentUploadForm;
