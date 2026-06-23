import { useState } from "react";
import AddVehiclePhotoForm from "./AddVehiclePhotoForm";
import AppIcon from "../ui/AppIcon";
import ModalShell from "../ui/ModalShell";
import { buttonClassNames } from "../ui/uiStyles";
import VehicleDetailSection from "./VehicleDetailSection";
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

function VehiclePhotoThumbnail({
  canManage,
  isMainPhoto,
  isDeleting,
  onDelete,
  onPreview,
  photo,
}) {
  const altText =
    photo.caption || `${formatPhotoType(photo.photo_type)} vehicle photo`;

  return (
    <article className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
      <button
        aria-label={`Preview ${formatPhotoType(photo.photo_type)} vehicle photo`}
        className="block h-32 w-full overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-emerald-200 sm:h-36"
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

      <span
        className={`pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ring-1 ring-inset ${photoTypeClassName(
          photo.photo_type
        )}`}
      >
        {formatPhotoType(photo.photo_type)}
      </span>

      {isMainPhoto && (
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
          Main
        </span>
      )}

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

function VehiclePhotoPreviewModal({
  canManage,
  errorMessage,
  isDeleting,
  isMainPhoto,
  isSettingMain,
  onClose,
  onDelete,
  onSetMain,
  photo,
}) {
  const caption = displayValue(photo.caption);
  const altText =
    photo.caption || `${formatPhotoType(photo.photo_type)} vehicle photo`;

  async function handleDelete() {
    const wasDeleted = await onDelete(photo);

    if (wasDeleted) {
      onClose();
    }
  }

  async function handleSetMain() {
    await onSetMain(photo);
  }

  return (
    <ModalShell
      eyebrow="Vehicle Photo"
      onClose={onClose}
      size="xl"
      title={formatPhotoType(photo.photo_type)}
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
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${photoTypeClassName(
                  photo.photo_type
                )}`}
              >
                {formatPhotoType(photo.photo_type)}
              </span>
              {isMainPhoto && (
                <span className="inline-flex rounded-full bg-slate-950 px-2.5 py-1 text-xs font-bold text-white">
                  Main Photo
                </span>
              )}
            </div>
            {photo.caption && (
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {caption}
              </p>
            )}
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-2">
              <button
                className={buttonClassNames.secondary}
                disabled={isMainPhoto || isSettingMain || isDeleting}
                onClick={handleSetMain}
                type="button"
              >
                {isMainPhoto
                  ? "Main Photo"
                  : isSettingMain
                    ? "Setting..."
                    : "Set as Main"}
              </button>
              <button
                className={buttonClassNames.danger}
                disabled={isDeleting || isSettingMain}
                onClick={handleDelete}
                type="button"
              >
                {isDeleting ? "Deleting..." : "Delete Photo"}
              </button>
            </div>
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

function VehiclePhotosSection({
  canManage = false,
  onActivityLogged,
  onSetMainPhoto,
  onVehiclePhotoAdded,
  onVehiclePhotoDeleted,
  primaryPhotoId = null,
  vehicleId,
  vehiclePhotos = [],
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [photoActionError, setPhotoActionError] = useState("");
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [settingMainPhotoId, setSettingMainPhotoId] = useState(null);
  const photoCountLabel = `${vehiclePhotos.length} ${
    vehiclePhotos.length === 1 ? "photo" : "photos"
  }`;

  function handlePreview(photo) {
    setPhotoActionError("");
    setPreviewPhoto(photo);
  }

  async function handleSetMainPhoto(photo) {
    if (settingMainPhotoId) {
      return false;
    }

    if (!canManage) {
      setPhotoActionError("Your role cannot update the main photo.");
      return false;
    }

    if (!photo?.id) {
      setPhotoActionError("Unable to set the main photo without a photo ID.");
      return false;
    }

    if (photo.id === primaryPhotoId) {
      return true;
    }

    setPhotoActionError("");
    setSettingMainPhotoId(photo.id);

    try {
      await onSetMainPhoto?.(photo);
      return true;
    } catch (error) {
      console.error("Could not update main vehicle photo:", error);
      setPhotoActionError(
        "Could not update main vehicle photo. Please try again."
      );
      return false;
    } finally {
      setSettingMainPhotoId(null);
    }
  }

  async function handleDelete(photo) {
    if (deletingPhotoId) {
      return false;
    }

    if (!canManage) {
      setPhotoActionError("Your role cannot delete photos.");
      return false;
    }

    if (!photo?.id) {
      setPhotoActionError("Unable to delete a photo without an ID.");
      return false;
    }

    if (!photo.photo_path) {
      setPhotoActionError(
        "Unable to delete this photo because its file path is missing."
      );
      return false;
    }

    const confirmed = window.confirm(
      "Delete this photo? This cannot be undone."
    );

    if (!confirmed) {
      return false;
    }

    setPhotoActionError("");
    setDeletingPhotoId(photo.id);

    try {
      const storageResponse = await supabase.storage
        .from("vehicle-photos")
        .remove([photo.photo_path]);

      if (storageResponse.error) {
        console.error("Could not delete photo:", storageResponse.error);
        setPhotoActionError("Could not delete photo. Please try again.");
        return false;
      }

      const deleteResponse = await supabase
        .from("vehicle_photos")
        .delete()
        .eq("id", photo.id);

      if (deleteResponse.error) {
        console.error("Could not delete photo:", deleteResponse.error);
        setPhotoActionError("Could not delete photo. Please try again.");
        return false;
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
      await onVehiclePhotoDeleted?.(photo);
      setPreviewPhoto((currentPhoto) =>
        currentPhoto?.id === photo.id ? null : currentPhoto
      );
      return true;
    } catch (error) {
      console.error("Could not delete photo:", error);
      setPhotoActionError("Could not delete photo. Please try again.");
      return false;
    } finally {
      setDeletingPhotoId(null);
    }
  }

  return (
    <VehicleDetailSection
      badge={String(vehiclePhotos.length)}
      icon="camera"
      summary={photoCountLabel}
      title="Vehicle Photos"
    >
      <div className="space-y-4">
        {canManage && (
          <div className="flex justify-end">
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
              onClick={() => {
                setPhotoActionError("");
                setIsFormOpen(true);
              }}
              type="button"
            >
              <AppIcon name="plus" size={17} />
              Upload Photo
            </button>
          </div>
        )}

        {vehiclePhotos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-sm text-slate-500">
            No vehicle photos have been uploaded yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {vehiclePhotos.map((photo, index) => (
              <VehiclePhotoThumbnail
                canManage={canManage}
                isMainPhoto={photo.id === primaryPhotoId}
                isDeleting={deletingPhotoId === photo.id}
                key={photo.id ?? index}
                onDelete={handleDelete}
                onPreview={handlePreview}
                photo={photo}
              />
            ))}
          </div>
        )}
      </div>

      {photoActionError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {photoActionError}
        </div>
      )}

      {isFormOpen && canManage && (
        <AddVehiclePhotoForm
          onClose={() => setIsFormOpen(false)}
          onActivityLogged={onActivityLogged}
          onPhotoAdded={onVehiclePhotoAdded}
          onSaved={() => setIsFormOpen(false)}
          vehicleId={vehicleId}
        />
      )}

      {previewPhoto && (
        <VehiclePhotoPreviewModal
          canManage={canManage}
          errorMessage={photoActionError}
          isDeleting={deletingPhotoId === previewPhoto.id}
          isMainPhoto={previewPhoto.id === primaryPhotoId}
          isSettingMain={settingMainPhotoId === previewPhoto.id}
          onClose={() => setPreviewPhoto(null)}
          onDelete={handleDelete}
          onSetMain={handleSetMainPhoto}
          photo={previewPhoto}
        />
      )}
    </VehicleDetailSection>
  );
}

export default VehiclePhotosSection;
