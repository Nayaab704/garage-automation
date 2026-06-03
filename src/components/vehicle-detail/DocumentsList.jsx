import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";
import AddDocumentUploadForm from "./AddDocumentUploadForm";

const documentTypeLabels = {
  purchase_receipt: "Purchase Receipt",
  third_party_invoice: "Third-Party Invoice",
};

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDocumentType(documentType) {
  return documentTypeLabels[documentType] ?? "Document";
}

function DocumentsList({
  canDelete = false,
  canUpload = false,
  currentProfile,
  description,
  documentType,
  documents = [],
  emptyMessage = "No documents uploaded yet.",
  onActivityLogged,
  onDocumentAdded,
  onDocumentDeleted,
  purchaseOrderId = null,
  repairJobId = null,
  thirdPartyRepairId = null,
  title = "Documents",
  uploadButtonLabel = "Upload Document",
  uploadTitle = "Upload Document",
  vehicleId,
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleDelete(documentRecord) {
    if (!canDelete) {
      setErrorMessage("Your role cannot delete documents.");
      return;
    }

    if (!documentRecord?.id) {
      setErrorMessage("Unable to delete a document without an ID.");
      return;
    }

    if (!documentRecord.file_path) {
      setErrorMessage(
        "Unable to delete this document because its file path is missing."
      );
      return;
    }

    const confirmed = window.confirm(
      "Delete this document? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setDeletingDocumentId(documentRecord.id);
    setErrorMessage("");

    try {
      const storageResponse = await supabase.storage
        .from("vehicle-documents")
        .remove([documentRecord.file_path]);

      if (storageResponse.error) {
        setErrorMessage(storageResponse.error.message);
        return;
      }

      const deleteResponse = await supabase
        .from("vehicle_documents")
        .delete()
        .eq("id", documentRecord.id);

      if (deleteResponse.error) {
        setErrorMessage(deleteResponse.error.message);
        return;
      }

      await logVehicleActivity({
        vehicleId,
        action: "Document deleted",
        details: {
          document_type: formatDocumentType(documentRecord.document_type),
          file_name: documentRecord.file_name,
        },
      });
      onActivityLogged?.();
      await onDocumentDeleted?.(documentRecord);
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setDeletingDocumentId(null);
    }
  }

  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h5 className="text-sm font-bold text-zinc-950">{title}</h5>
          <p className="mt-1 text-xs text-zinc-500">
            {documents.length}{" "}
            {documents.length === 1 ? "document" : "documents"}
          </p>
        </div>

        {canUpload && (
          <button
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
            onClick={() => {
              setErrorMessage("");
              setIsFormOpen(true);
            }}
            type="button"
          >
            {uploadButtonLabel}
          </button>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((documentRecord, index) => (
            <article
              className="rounded-md border border-zinc-200 bg-white p-4"
              key={documentRecord.id ?? index}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h6 className="font-semibold text-zinc-950">
                    {displayValue(documentRecord.file_name)}
                  </h6>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                      {formatDocumentType(documentRecord.document_type)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {formatDate(documentRecord.created_at)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <a
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                    href={documentRecord.file_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open/View
                  </a>

                  {canDelete && (
                    <button
                      className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={deletingDocumentId === documentRecord.id}
                      onClick={() => handleDelete(documentRecord)}
                      type="button"
                    >
                      {deletingDocumentId === documentRecord.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  )}
                </div>
              </div>

              {documentRecord.notes && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                  {documentRecord.notes}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {isFormOpen && canUpload && (
        <AddDocumentUploadForm
          currentProfile={currentProfile}
          description={description}
          documentType={documentType}
          onActivityLogged={onActivityLogged}
          onClose={() => setIsFormOpen(false)}
          onDocumentAdded={async (documentRecord) => {
            await onDocumentAdded?.(documentRecord);
            setIsFormOpen(false);
          }}
          purchaseOrderId={purchaseOrderId}
          repairJobId={repairJobId}
          thirdPartyRepairId={thirdPartyRepairId}
          title={uploadTitle}
          vehicleId={vehicleId}
        />
      )}
    </div>
  );
}

export default DocumentsList;
