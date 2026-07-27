import { logVehicleActivity } from "./activityLogger";
import {
  getRepairPhotoCleanupPlan,
  isVehicleStoragePath,
} from "./repairPhotoCleanupRules";
import { supabase } from "./supabaseClient";
import { normalizeVehicleStatus } from "./vehicleStatus";

const PHOTO_BUCKET = "vehicle-photos";

function createCleanupSummary() {
  return {
    deletedCount: 0,
    deletedPhotoIds: [],
    error: null,
    failedCount: 0,
    keptCount: 0,
  };
}

function groupCandidatesByPath(candidates, vehicleId, summary) {
  const candidatesByPath = new Map();
  const seenPhotoIds = new Set();

  for (const photo of candidates) {
    const photoId = String(photo?.id ?? "").trim();
    const photoPath = String(photo?.photo_path ?? "").trim();

    if (
      !photoId ||
      seenPhotoIds.has(photoId) ||
      !isVehicleStoragePath(photoPath, vehicleId)
    ) {
      summary.failedCount += 1;
      continue;
    }

    seenPhotoIds.add(photoId);

    const pathCandidates = candidatesByPath.get(photoPath) ?? [];
    pathCandidates.push(photo);
    candidatesByPath.set(photoPath, pathCandidates);
  }

  return candidatesByPath;
}

function hasSameIds(firstRows, secondRows) {
  const firstIds = new Set(firstRows.map((row) => row?.id).filter(Boolean));
  const secondIds = new Set(secondRows.map((row) => row?.id).filter(Boolean));

  return (
    firstIds.size === secondIds.size &&
    [...firstIds].every((id) => secondIds.has(id))
  );
}

async function validateCandidatePath({
  photoPath,
  photos,
  repairJobIds,
  vehicleId,
}) {
  const photoIds = photos.map((photo) => photo.id);
  const photoUrls = [
    ...new Set(
      photos
        .map((photo) => String(photo?.photo_url ?? "").trim())
        .filter(Boolean)
    ),
  ];
  const [
    pathReferencesResponse,
    urlReferencesResponse,
    primaryReferencesResponse,
    targetVehicleResponse,
  ] = await Promise.all([
    supabase
      .from("vehicle_photos")
      .select("*")
      .eq("photo_path", photoPath),
    photoUrls.length > 0
      ? supabase
          .from("vehicle_photos")
          .select("id, photo_path, photo_url")
          .in("photo_url", photoUrls)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("vehicles")
      .select("id, primary_photo_id")
      .in("primary_photo_id", photoIds),
    supabase
      .from("vehicles")
      .select("id, primary_photo_id, status")
      .eq("id", vehicleId)
      .maybeSingle(),
  ]);

  if (
    pathReferencesResponse.error ||
    urlReferencesResponse.error ||
    primaryReferencesResponse.error ||
    targetVehicleResponse.error
  ) {
    return {
      error:
        pathReferencesResponse.error ??
        urlReferencesResponse.error ??
        primaryReferencesResponse.error ??
        targetVehicleResponse.error,
      isSafe: false,
    };
  }

  const currentPathReferences = pathReferencesResponse.data ?? [];
  const plannedPhotoIds = new Set(photoIds);
  const currentPlan = getRepairPhotoCleanupPlan({
    photos: currentPathReferences,
    preserveAtLeastOne: false,
    primaryPhotoId: null,
    repairJobIds,
    vehicleId,
  });
  const hasUnexpectedReference =
    !hasSameIds(currentPathReferences, photos) ||
    (urlReferencesResponse.data ?? []).some(
      (photo) => !plannedPhotoIds.has(photo.id)
    ) ||
    currentPathReferences.some(
      (photo) =>
        !photo.id ||
        photo.vehicle_id !== vehicleId ||
        photo.photo_path !== photoPath
    );
  const isSafe =
    !hasUnexpectedReference &&
    normalizeVehicleStatus(targetVehicleResponse.data?.status) ===
      "ready_for_sale" &&
    (primaryReferencesResponse.data ?? []).length === 0 &&
    currentPlan.keptCount === 0 &&
    hasSameIds(currentPlan.candidates, photos);

  return { error: null, isSafe };
}

async function removeCandidatePath({
  photoPath,
  photos,
  repairJobIds,
  summary,
  vehicleId,
}) {
  const validation = await validateCandidatePath({
    photoPath,
    photos,
    repairJobIds,
    vehicleId,
  });

  if (validation.error || !validation.isSafe) {
    if (validation.error) {
      console.error(
        "Could not verify repair photo references:",
        validation.error
      );
    }

    summary.failedCount += photos.length;
    return;
  }

  const storageResponse = await supabase.storage
    .from(PHOTO_BUCKET)
    .remove([photoPath]);

  if (storageResponse.error) {
    console.error(
      `Could not remove repair photo from ${PHOTO_BUCKET}:`,
      storageResponse.error
    );
    summary.failedCount += photos.length;
    return;
  }

  const photoIds = photos.map((photo) => photo.id);
  const deleteResponse = await supabase
    .from("vehicle_photos")
    .delete()
    .eq("vehicle_id", vehicleId)
    .eq("photo_path", photoPath)
    .in("id", photoIds)
    .select("id");

  if (deleteResponse.error) {
    console.error(
      "Repair photo storage was removed, but database cleanup failed:",
      deleteResponse.error
    );
    summary.failedCount += photos.length;
    return;
  }

  const deletedIds = new Set(
    (deleteResponse.data ?? []).map((photo) => photo.id).filter(Boolean)
  );

  for (const photo of photos) {
    if (deletedIds.has(photo.id)) {
      summary.deletedCount += 1;
      summary.deletedPhotoIds.push(photo.id);
    } else {
      summary.failedCount += 1;
    }
  }
}

export async function cleanupRepairPhotosForReadySale(vehicleId) {
  const summary = createCleanupSummary();
  const normalizedVehicleId = String(vehicleId ?? "").trim();

  if (!normalizedVehicleId) {
    summary.error = new Error("A vehicle ID is required for photo cleanup.");
    return summary;
  }

  try {
    const [
      authorizationResponse,
      actorProfileResponse,
      vehicleResponse,
      photosResponse,
      repairJobsResponse,
    ] = await Promise.all([
      supabase.rpc("is_admin_or_manager"),
      supabase.rpc("current_profile_id"),
      supabase
        .from("vehicles")
        .select("id, primary_photo_id, status")
        .eq("id", normalizedVehicleId)
        .maybeSingle(),
      supabase
        .from("vehicle_photos")
        .select("*")
        .eq("vehicle_id", normalizedVehicleId),
      supabase
        .from("repair_jobs")
        .select("id")
        .eq("vehicle_id", normalizedVehicleId),
    ]);

    if (
      authorizationResponse.error ||
      authorizationResponse.data !== true
    ) {
      summary.error =
        authorizationResponse.error ??
        new Error("Only an active admin or manager can clean repair photos.");
      console.error("Repair photo cleanup was not authorized:", summary.error);
      return summary;
    }

    if (actorProfileResponse.error || !actorProfileResponse.data) {
      summary.error =
        actorProfileResponse.error ??
        new Error("The current user could not be identified for photo cleanup.");
      console.error(
        "Repair photo cleanup could not identify the active user:",
        summary.error
      );
      return summary;
    }

    if (
      vehicleResponse.error ||
      photosResponse.error ||
      repairJobsResponse.error
    ) {
      summary.error =
        vehicleResponse.error ??
        photosResponse.error ??
        repairJobsResponse.error;
      console.error("Could not prepare repair photo cleanup:", summary.error);
      return summary;
    }

    if (!vehicleResponse.data) {
      summary.error = new Error("Vehicle could not be found for photo cleanup.");
      return summary;
    }

    if (
      normalizeVehicleStatus(vehicleResponse.data.status) !== "ready_for_sale"
    ) {
      summary.error = new Error(
        "Repair photos can only be cleaned after the vehicle is Ready for Sale."
      );
      return summary;
    }

    const repairJobIds = (repairJobsResponse.data ?? []).map(
      (repairJob) => repairJob.id
    );
    const plan = getRepairPhotoCleanupPlan({
      photos: photosResponse.data ?? [],
      primaryPhotoId: vehicleResponse.data.primary_photo_id,
      repairJobIds,
      vehicleId: normalizedVehicleId,
    });
    summary.keptCount = plan.keptCount;
    const candidatesByPath = groupCandidatesByPath(
      plan.candidates,
      normalizedVehicleId,
      summary
    );

    for (const [photoPath, photos] of candidatesByPath) {
      await removeCandidatePath({
        photoPath,
        photos,
        repairJobIds,
        summary,
        vehicleId: normalizedVehicleId,
      });
    }

    await logVehicleActivity({
      vehicleId: normalizedVehicleId,
      userId: actorProfileResponse.data,
      action: "repair_photos_cleaned",
      details: {
        deleted_count: summary.deletedCount,
        failed_count: summary.failedCount,
        kept_count: summary.keptCount,
      },
    });

    return summary;
  } catch (error) {
    console.error("Could not clean repair photos:", error);
    summary.error = error;
    return summary;
  }
}
