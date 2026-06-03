import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";
import AddWorkOrderPhotoForm from "./AddWorkOrderPhotoForm";

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

function PhotoCard({ canManage, isDeleting, onDelete, photo }) {
  const caption = displayValue(photo.caption);
  const altText = photo.caption || "Work order photo";

  return (
    <article className="overflow-hidden rounded-md border border-zinc-100 bg-white">
      <div className="aspect-[4/3] bg-zinc-100">
        <img
          alt={altText}
          className="h-full w-full object-cover"
          loading="lazy"
          src={photo.photo_url}
        />
      </div>

      <div className="space-y-2 p-3">
        {photo.caption && (
          <p className="whitespace-pre-wrap text-sm leading-5 text-zinc-700">
            {caption}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">
            {formatDateTime(photo.created_at)}
          </p>

          {canManage && (
            <button
              className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isDeleting}
              onClick={() => onDelete(photo)}
              type="button"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function WorkOrderPhotosList({
  canManage = false,
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

  async function handleDelete(photo) {
    if (!canManage) {
      setErrorMessage("Your role cannot delete photos.");
      return;
    }

    if (!photo?.id) {
      setErrorMessage("Unable to delete a photo without an ID.");
      return;
    }

    if (!photo.photo_path) {
      setErrorMessage("Unable to delete this photo because its file path is missing.");
      return;
    }

    const confirmed = window.confirm(
      "Delete this photo? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setDeletingPhotoId(photo.id);
    setErrorMessage("");

    try {
      const storageResponse = await supabase.storage
        .from("vehicle-photos")
        .remove([photo.photo_path]);

      if (storageResponse.error) {
        setErrorMessage(storageResponse.error.message);
        return;
      }

      const deleteResponse = await supabase
        .from("vehicle_photos")
        .delete()
        .eq("id", photo.id);

      if (deleteResponse.error) {
        setErrorMessage(deleteResponse.error.message);
        return;
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
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setDeletingPhotoId(null);
    }
  }

  return (
    <div className="rounded-md bg-zinc-50 p-3">
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

      {photos.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-200 bg-white p-3 text-sm text-zinc-500">
          No photos uploaded yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo, index) => (
            <PhotoCard
              canManage={canManage}
              isDeleting={deletingPhotoId === photo.id}
              key={photo.id ?? index}
              onDelete={handleDelete}
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
    </div>
  );
}

export default WorkOrderPhotosList;
