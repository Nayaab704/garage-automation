const DELETABLE_PHOTO_TYPES = new Set([
  "before",
  "repair",
  "repair_photo",
  "temp",
  "temporary",
  "work_order",
  "work_order_photo",
]);

const PROTECTED_PHOTO_MARKERS = new Set([
  "after",
  "certificate",
  "checklist",
  "complete",
  "completed",
  "completion",
  "condition",
  "contract",
  "delivery",
  "document",
  "final",
  "finished",
  "inspection",
  "intake",
  "invoice",
  "listing",
  "main",
  "marketing",
  "odometer",
  "purchase",
  "primary",
  "receipt",
  "registration",
  "sale",
  "sales",
  "showroom",
  "title",
  "warranty",
]);

const REPAIR_PATH_PATTERN =
  /\/(?:before|repair-jobs?|repairs?|temp|temporary|work-orders?)\//;

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeMarker(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getMarkerWords(value) {
  return new Set(
    normalizeText(value)
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
  );
}

function getPhotoPath(photo) {
  return normalizeText(photo?.photo_path);
}

function hasProtectedMarker(photo) {
  const markerValues = [
    photo?.photo_type,
    photo?.category,
    photo?.stage,
    photo?.kind,
    photo?.tag,
  ];
  const exactMarkers = markerValues
    .map(normalizeMarker)
    .filter(Boolean);

  if (
    exactMarkers.some((marker) => PROTECTED_PHOTO_MARKERS.has(marker))
  ) {
    return true;
  }

  const descriptiveValues = [
    ...markerValues,
    photo?.caption,
    photo?.photo_path,
  ];

  return descriptiveValues.some((value) => {
    const words = getMarkerWords(value);

    return [...PROTECTED_PHOTO_MARKERS].some((marker) =>
      [...words].some((word) => word === marker || word.startsWith(marker))
    );
  });
}

function isPrimaryPhoto(photo, primaryPhotoId) {
  return (
    Boolean(photo?.id && primaryPhotoId && photo.id === primaryPhotoId) ||
    photo?.is_primary === true
  );
}

function isClearlyRepairPhoto(photo, repairJobIds) {
  if (photo?.repair_job_id) {
    if (repairJobIds && !repairJobIds.has(photo.repair_job_id)) {
      return false;
    }

    return true;
  }

  const photoType = normalizeMarker(photo?.photo_type);

  if (DELETABLE_PHOTO_TYPES.has(photoType)) {
    return true;
  }

  const photoPath = `/${getPhotoPath(photo).replace(/^\/+|\/+$/g, "")}/`;

  return REPAIR_PATH_PATTERN.test(photoPath);
}

export function isVehicleStoragePath(photoPath, vehicleId) {
  const normalizedPath = String(photoPath ?? "").trim();
  const normalizedVehicleId = String(vehicleId ?? "").trim();

  if (!normalizedPath || !normalizedVehicleId) {
    return false;
  }

  const pathSegments = normalizedPath.split("/");

  return (
    normalizedPath.startsWith(`vehicles/${normalizedVehicleId}/`) &&
    pathSegments.every(
      (segment) => segment && segment !== "." && segment !== ".."
    )
  );
}

export function getRepairPhotoCleanupPlan({
  photos = [],
  preserveAtLeastOne = true,
  primaryPhotoId = null,
  repairJobIds = null,
  vehicleId = null,
} = {}) {
  const normalizedPhotos = Array.isArray(photos)
    ? photos.filter((photo) => photo && typeof photo === "object")
    : [];
  const knownRepairJobIds = Array.isArray(repairJobIds)
    ? new Set(repairJobIds.filter(Boolean))
    : null;
  const preliminaryRows = normalizedPhotos.map((photo) => {
    const protectedPhoto =
      isPrimaryPhoto(photo, primaryPhotoId) || hasProtectedMarker(photo);
    const photoPath = String(photo?.photo_path ?? "").trim();
    const hasUsableReference =
      Boolean(photo?.id && photoPath) &&
      (!vehicleId || isVehicleStoragePath(photoPath, vehicleId));

    return {
      isCandidate:
        !protectedPhoto &&
        hasUsableReference &&
        isClearlyRepairPhoto(photo, knownRepairJobIds),
      photo,
    };
  });
  const pathsUsedByKeptPhotos = new Set(
    preliminaryRows
      .filter(({ isCandidate }) => !isCandidate)
      .map(({ photo }) => getPhotoPath(photo))
      .filter(Boolean)
  );
  const candidates = [];
  const kept = [];

  for (const row of preliminaryRows) {
    const photoPath = getPhotoPath(row.photo);
    const sharesPathWithKeptPhoto =
      photoPath && pathsUsedByKeptPhotos.has(photoPath);

    if (row.isCandidate && !sharesPathWithKeptPhoto) {
      candidates.push(row.photo);
    } else {
      kept.push(row.photo);
    }
  }

  if (preserveAtLeastOne && kept.length === 0 && candidates.length > 0) {
    const photoToKeep = [...candidates].sort((firstPhoto, secondPhoto) => {
      const firstCreatedAt = Date.parse(firstPhoto?.created_at ?? "") || 0;
      const secondCreatedAt = Date.parse(secondPhoto?.created_at ?? "") || 0;

      return secondCreatedAt - firstCreatedAt;
    })[0];
    const pathToKeep = getPhotoPath(photoToKeep);
    const photosToKeep = candidates.filter(
      (photo) =>
        photo === photoToKeep ||
        (pathToKeep && getPhotoPath(photo) === pathToKeep)
    );
    const idsToKeep = new Set(photosToKeep.map((photo) => photo?.id));

    kept.push(...photosToKeep);
    candidates.splice(
      0,
      candidates.length,
      ...candidates.filter((photo) => !idsToKeep.has(photo?.id))
    );
  }

  return {
    candidateCount: candidates.length,
    candidates,
    kept,
    keptCount: kept.length,
  };
}
