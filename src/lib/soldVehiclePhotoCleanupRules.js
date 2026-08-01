import { isVehicleStoragePath } from "./repairPhotoCleanupRules.js";

export const SOLD_PHOTO_CLEANUP_WARNING =
  "Sale saved, but some photos may need cleanup.";
export const VEHICLE_PHOTO_BUCKET = "vehicle-photos";

function normalizeText(value) {
  return String(value ?? "").trim();
}

export function normalizeVehiclePhotoStoragePath(
  value,
  bucketName = VEHICLE_PHOTO_BUCKET
) {
  const rawValue = normalizeText(value);

  if (!rawValue) {
    return "";
  }

  if (!/^https?:\/\//i.test(rawValue)) {
    try {
      return decodeURIComponent(rawValue.replace(/^\/+/, ""));
    } catch {
      return "";
    }
  }

  try {
    const url = new URL(rawValue);
    const encodedBucketName = encodeURIComponent(bucketName);
    const pathMarkers = [
      `/storage/v1/object/public/${encodedBucketName}/`,
      `/storage/v1/object/sign/${encodedBucketName}/`,
      `/storage/v1/object/authenticated/${encodedBucketName}/`,
    ];
    const marker = pathMarkers.find((candidate) =>
      url.pathname.includes(candidate)
    );

    if (!marker) {
      return "";
    }

    return decodeURIComponent(url.pathname.split(marker)[1] ?? "").replace(
      /^\/+/,
      ""
    );
  } catch {
    return "";
  }
}

function hasManagedStorageReference(photo) {
  const photoPath = normalizeText(photo?.photo_path);
  const photoUrl = normalizeText(photo?.photo_url);

  return (
    Boolean(photoPath) ||
    photoUrl.includes(`/storage/v1/object/public/${VEHICLE_PHOTO_BUCKET}/`) ||
    photoUrl.includes(`/storage/v1/object/sign/${VEHICLE_PHOTO_BUCKET}/`) ||
    photoUrl.includes(
      `/storage/v1/object/authenticated/${VEHICLE_PHOTO_BUCKET}/`
    )
  );
}

function getPhotoStoragePath(photo) {
  const pathFromColumn = normalizeVehiclePhotoStoragePath(photo?.photo_path);

  if (pathFromColumn) {
    return pathFromColumn;
  }

  return normalizeVehiclePhotoStoragePath(photo?.photo_url);
}

export function getSoldVehiclePhotoCleanupPlan({ photos = [], vehicleId } = {}) {
  const normalizedVehicleId = normalizeText(vehicleId);
  const databaseOnlyPhotoIds = [];
  const photosByStoragePath = new Map();
  const seenPhotoIds = new Set();
  const unsafePhotoIds = [];

  for (const photo of Array.isArray(photos) ? photos : []) {
    const photoId = normalizeText(photo?.id);

    if (!photoId || seenPhotoIds.has(photoId)) {
      if (!photoId) {
        unsafePhotoIds.push(photoId);
      }
      continue;
    }

    seenPhotoIds.add(photoId);

    const storagePath = getPhotoStoragePath(photo);

    if (!storagePath) {
      if (hasManagedStorageReference(photo)) {
        unsafePhotoIds.push(photoId);
      } else {
        databaseOnlyPhotoIds.push(photoId);
      }
      continue;
    }

    if (!isVehicleStoragePath(storagePath, normalizedVehicleId)) {
      unsafePhotoIds.push(photoId);
      continue;
    }

    const pathPhotos = photosByStoragePath.get(storagePath) ?? [];
    pathPhotos.push({ ...photo, storagePath });
    photosByStoragePath.set(storagePath, pathPhotos);
  }

  return {
    databaseOnlyPhotoIds,
    photoCount: seenPhotoIds.size,
    photosByStoragePath,
    storagePaths: [...photosByStoragePath.keys()],
    unsafePhotoIds,
  };
}
