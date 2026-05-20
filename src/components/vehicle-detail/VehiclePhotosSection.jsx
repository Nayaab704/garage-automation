import { useState } from "react";
import AddVehiclePhotoForm from "./AddVehiclePhotoForm";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";

const photoTypeLabels = {
  general: "General",
  damage: "Damage",
  before: "Before",
  after: "After",
  document: "Document",
};

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatPhotoType(photoType) {
  return photoTypeLabels[photoType] ?? "General";
}

function photoTypeClassName(photoType) {
  if (photoType === "damage") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (photoType === "before") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (photoType === "after") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (photoType === "document") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function PhotoCard({ canManage, isDeleting, onDelete, photo }) {
  const caption = displayValue(photo.caption);
  const altText =
    photo.caption || `${formatPhotoType(photo.photo_type)} vehicle photo`;

  return (
    <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="aspect-[4/3] bg-zinc-100">
        <img
          alt={altText}
          className="h-full w-full object-cover"
          loading="lazy"
          src={photo.photo_url}
        />
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${photoTypeClassName(
              photo.photo_type
            )}`}
          >
            {formatPhotoType(photo.photo_type)}
          </span>

          {canManage && (
            <button
              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isDeleting}
              onClick={() => onDelete(photo)}
              type="button"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>

        {photo.caption && (
          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {caption}
          </p>
        )}
      </div>
    </article>
  );
}

function VehiclePhotosSection({
  canManage = false,
  onActivityLogged,
  onVehiclePhotoChanged,
  vehicleId,
  vehiclePhotos = [],
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);

  async function handleDelete(photo) {
    if (!canManage) {
      setDeleteError("Your role cannot delete photos.");
      return;
    }

    if (!photo?.id) {
      setDeleteError("Unable to delete a photo without an ID.");
      return;
    }

    if (!photo.photo_path) {
      setDeleteError("Unable to delete this photo because its file path is missing.");
      return;
    }

    const confirmed = window.confirm(
      "Delete this photo? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setDeleteError("");
    setDeletingPhotoId(photo.id);

    try {
      const storageResponse = await supabase.storage
        .from("vehicle-photos")
        .remove([photo.photo_path]);

      if (storageResponse.error) {
        setDeleteError(storageResponse.error.message);
        return;
      }

      const deleteResponse = await supabase
        .from("vehicle_photos")
        .delete()
        .eq("id", photo.id);

      if (deleteResponse.error) {
        setDeleteError(deleteResponse.error.message);
        return;
      }

      await logVehicleActivity({
        vehicleId,
        action: "Photo deleted",
        details: {
          photo_type: photo.photo_type,
          caption: photo.caption,
        },
      });
      onActivityLogged?.();
      await onVehiclePhotoChanged();
    } catch (error) {
      setDeleteError(error.message ?? "Something went wrong.");
    } finally {
      setDeletingPhotoId(null);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">Vehicle Photos</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {vehiclePhotos.length}{" "}
            {vehiclePhotos.length === 1 ? "photo" : "photos"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">
            {vehiclePhotos.length}
          </span>
          {canManage && (
            <button
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
              onClick={() => setIsFormOpen(true)}
              type="button"
            >
              Upload Photo
            </button>
          )}
        </div>
      </div>

      {vehiclePhotos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          No vehicle photos have been uploaded yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {vehiclePhotos.map((photo, index) => (
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

      {deleteError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {deleteError}
        </div>
      )}

      {isFormOpen && canManage && (
        <AddVehiclePhotoForm
          onClose={() => setIsFormOpen(false)}
          onActivityLogged={onActivityLogged}
          onPhotoAdded={onVehiclePhotoChanged}
          vehicleId={vehicleId}
        />
      )}
    </section>
  );
}

export default VehiclePhotosSection;
