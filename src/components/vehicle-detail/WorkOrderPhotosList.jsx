import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";
import AddWorkOrderPhotoForm from "./AddWorkOrderPhotoForm";
import ModalShell from "../ui/ModalShell";
import { buttonClassNames } from "../ui/uiStyles";

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatDateTime(value) {
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

function getWorkOrderTitle(workOrder) {
  return workOrder?.title || workOrder?.name || "Work Order";
}

function PhotoThumbnail({ canManage, isDeleting, onDelete, onPreview, photo }) {
  const altText = photo.caption || "Work order photo";

  return (
    <article className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
      <button
        aria-label="Preview work order photo"
        className="block h-28 w-full overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-blue-200 sm:h-32"
        onClick={() => onPreview(photo)}
        type="button"
      >
        <img
          alt={altText}
          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
          loading="lazy"
          src={photo.photo_url}
        />
      </button>

      <span className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200">
        {photo.caption || formatDateTime(photo.created_at)}
      </span>

      {canManage && (
        <button
          className="absolute right-2 top-2 rounded-full border border-red-200 bg-white/95 px-2.5 py-1 text-xs font-bold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isDeleting}
          onClick={() => onDelete(photo)}
          type="button"
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      )}
    </article>
  );
}

function PhotoPreviewModal({
  canManage,
  errorMessage,
  isDeleting,
  onClose,
  onDelete,
  photo,
  workOrder,
}) {
  const caption = displayValue(photo.caption);
  const altText = photo.caption || "Work order photo";

  async function handleDelete() {
    const wasDeleted = await onDelete(photo);

    if (wasDeleted) {
      onClose();
    }
  }

  return (
    <ModalShell
      eyebrow={getWorkOrderTitle(workOrder)}
      onClose={onClose}
      size="xl"
      title="Photo Preview"
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
          <img
            alt={altText}
            className="max-h-[68vh] w-full object-contain"
            src={photo.photo_url}
          />
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
              {formatDateTime(photo.created_at)}
            </span>
            {photo.caption && (
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {caption}
              </p>
            )}
          </div>

          {canManage && (
            <button
              className={buttonClassNames.danger}
              disabled={isDeleting}
              onClick={handleDelete}
              type="button"
            >
              {isDeleting ? "Deleting..." : "Delete Photo"}
            </button>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function WorkOrderPhotosList({
  canManage = false,
  hideHeader = false,
  onActivityLogged,
  onPhotoAdded,
  onPhotoDeleted,
  photos = [],
  showAddButton = true,
  vehicleId,
  workOrder,
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState(null);

  function handlePreview(photo) {
    setErrorMessage("");
    setPreviewPhoto(photo);
  }

  async function handleDelete(photo) {
    if (deletingPhotoId) {
      return false;
    }

    if (!canManage) {
      setErrorMessage("Your role cannot delete photos.");
      return false;
    }

    if (!photo?.id) {
      setErrorMessage("Unable to delete a photo without an ID.");
      return false;
    }

    if (!photo.photo_path) {
      setErrorMessage("Unable to delete this photo because its file path is missing.");
      return false;
    }

    const confirmed = window.confirm(
      "Delete this photo? This cannot be undone."
    );

    if (!confirmed) {
      return false;
    }

    setDeletingPhotoId(photo.id);
    setErrorMessage("");

    try {
      const storageResponse = await supabase.storage
        .from("vehicle-photos")
        .remove([photo.photo_path]);

      if (storageResponse.error) {
        console.error("Could not delete photo:", storageResponse.error);
        setErrorMessage("Could not delete photo. Please try again.");
        return false;
      }

      const deleteResponse = await supabase
        .from("vehicle_photos")
        .delete()
        .eq("id", photo.id);

      if (deleteResponse.error) {
        console.error("Could not delete photo:", deleteResponse.error);
        setErrorMessage("Could not delete photo. Please try again.");
        return false;
      }

      await logVehicleActivity({
        vehicleId,
        action: "Photo deleted",
        details: {
          caption: photo.caption,
          work_order: getWorkOrderTitle(workOrder),
        },
      });
      onActivityLogged?.();
      await onPhotoDeleted?.(photo);
      setPreviewPhoto((currentPhoto) =>
        currentPhoto?.id === photo.id ? null : currentPhoto
      );
      return true;
    } catch (error) {
      console.error("Could not delete photo:", error);
      setErrorMessage("Could not delete photo. Please try again.");
      return false;
    } finally {
      setDeletingPhotoId(null);
    }
  }

  return (
    <div className="rounded-md bg-zinc-50 p-3">
      {!hideHeader && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h5 className="text-sm font-bold text-zinc-950">Photos</h5>
            <p className="mt-1 text-xs text-zinc-500">
              {photos.length} {photos.length === 1 ? "photo" : "photos"}
            </p>
          </div>

          {canManage && showAddButton && (
            <button
              className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              onClick={() => {
                setErrorMessage("");
                setIsFormOpen(true);
              }}
              type="button"
            >
              Add Photo
            </button>
          )}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-200 bg-white p-3 text-sm text-zinc-500">
          No photos uploaded yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => (
            <PhotoThumbnail
              canManage={canManage}
              isDeleting={deletingPhotoId === photo.id}
              key={photo.id ?? index}
              onDelete={handleDelete}
              onPreview={handlePreview}
              photo={photo}
            />
          ))}
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {isFormOpen && canManage && (
        <AddWorkOrderPhotoForm
          onActivityLogged={onActivityLogged}
          onClose={() => setIsFormOpen(false)}
          onPhotoAdded={async (photo) => {
            await onPhotoAdded?.(photo);
            setIsFormOpen(false);
          }}
          vehicleId={vehicleId}
          workOrder={workOrder}
        />
      )}

      {previewPhoto && (
        <PhotoPreviewModal
          canManage={canManage}
          errorMessage={errorMessage}
          isDeleting={deletingPhotoId === previewPhoto.id}
          onClose={() => setPreviewPhoto(null)}
          onDelete={handleDelete}
          photo={previewPhoto}
          workOrder={workOrder}
        />
      )}
    </div>
  );
}

export default WorkOrderPhotosList;
