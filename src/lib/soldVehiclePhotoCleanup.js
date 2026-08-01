import {
  getSoldVehiclePhotoCleanupPlan,
  SOLD_PHOTO_CLEANUP_WARNING,
  VEHICLE_PHOTO_BUCKET,
} from "./soldVehiclePhotoCleanupRules.js";

const DELETE_BATCH_SIZE = 100;
const REPAIR_JOB_BATCH_SIZE = 100;

function createCleanupSummary() {
  return {
    completed: false,
    deletedCount: 0,
    deletedPhotoIds: [],
    error: null,
    failedCount: 0,
    primaryPhotoCleared: false,
    warning: SOLD_PHOTO_CLEANUP_WARNING,
  };
}

function uniqueRowsById(rows = []) {
  const rowsById = new Map();

  for (const row of rows) {
    if (row?.id) {
      rowsById.set(row.id, row);
    }
  }

  return [...rowsById.values()];
}

async function fetchVehiclePhotoRows(client, vehicleId) {
  const repairJobsResponse = await client
    .from("repair_jobs")
    .select("id")
    .eq("vehicle_id", vehicleId);

  if (repairJobsResponse.error) {
    return { data: [], error: repairJobsResponse.error };
  }

  const directPhotosResponse = await client
    .from("vehicle_photos")
    .select("*")
    .eq("vehicle_id", vehicleId);

  if (directPhotosResponse.error) {
    return { data: [], error: directPhotosResponse.error };
  }

  const repairJobIds = (repairJobsResponse.data ?? [])
    .map((repairJob) => repairJob?.id)
    .filter(Boolean);
  const linkedPhotos = [];

  for (
    let startIndex = 0;
    startIndex < repairJobIds.length;
    startIndex += REPAIR_JOB_BATCH_SIZE
  ) {
    const repairJobBatch = repairJobIds.slice(
      startIndex,
      startIndex + REPAIR_JOB_BATCH_SIZE
    );
    const linkedPhotosResponse = await client
      .from("vehicle_photos")
      .select("*")
      .in("repair_job_id", repairJobBatch);

    if (linkedPhotosResponse.error) {
      return { data: [], error: linkedPhotosResponse.error };
    }

    linkedPhotos.push(...(linkedPhotosResponse.data ?? []));
  }

  return {
    data: uniqueRowsById([
      ...(directPhotosResponse.data ?? []),
      ...linkedPhotos,
    ]),
    error: null,
  };
}

async function clearPrimaryPhoto(client, vehicleId) {
  const response = await client
    .from("vehicles")
    .update({ primary_photo_id: null })
    .eq("id", vehicleId)
    .select("id, primary_photo_id")
    .maybeSingle();

  return {
    cleared:
      !response.error &&
      Boolean(response.data?.id) &&
      response.data.primary_photo_id === null,
    error: response.error ?? null,
  };
}

async function validateStoragePathReferences({
  client,
  pathPhotos,
  storagePath,
}) {
  const expectedPhotoIds = new Set(
    pathPhotos.map((photo) => photo?.id).filter(Boolean)
  );
  const photoUrls = [
    ...new Set(
      pathPhotos
        .map((photo) => String(photo?.photo_url ?? "").trim())
        .filter(Boolean)
    ),
  ];
  const [pathReferencesResponse, urlReferencesResponse, primaryResponse] =
    await Promise.all([
      client
        .from("vehicle_photos")
        .select("id, vehicle_id, repair_job_id, photo_path, photo_url")
        .eq("photo_path", storagePath),
      photoUrls.length > 0
        ? client
            .from("vehicle_photos")
            .select("id, vehicle_id, repair_job_id, photo_path, photo_url")
            .in("photo_url", photoUrls)
        : Promise.resolve({ data: [], error: null }),
      client
        .from("vehicles")
        .select("id, primary_photo_id")
        .in("primary_photo_id", [...expectedPhotoIds]),
    ]);

  const error =
    pathReferencesResponse.error ??
    urlReferencesResponse.error ??
    primaryResponse.error ??
    null;

  if (error) {
    return { error, isSafe: false };
  }

  const unexpectedPhotoReference = [
    ...(pathReferencesResponse.data ?? []),
    ...(urlReferencesResponse.data ?? []),
  ].some((photo) => !expectedPhotoIds.has(photo?.id));

  return {
    error: null,
    isSafe:
      !unexpectedPhotoReference && (primaryResponse.data ?? []).length === 0,
  };
}

async function deletePhotoRows(client, photoIds) {
  let firstError = null;

  for (
    let startIndex = 0;
    startIndex < photoIds.length;
    startIndex += DELETE_BATCH_SIZE
  ) {
    const photoIdBatch = photoIds.slice(
      startIndex,
      startIndex + DELETE_BATCH_SIZE
    );
    const response = await client
      .from("vehicle_photos")
      .delete()
      .in("id", photoIdBatch)
      .select("id");

    if (response.error && !firstError) {
      firstError = response.error;
    }
  }

  return firstError;
}

async function removeStoragePath(client, storagePath) {
  try {
    const response = await client.storage
      .from(VEHICLE_PHOTO_BUCKET)
      .remove([storagePath]);

    return response.error ?? null;
  } catch (error) {
    return error;
  }
}

async function verifyPrimaryPhotoCleared(client, vehicleId) {
  const response = await client
    .from("vehicles")
    .select("id, primary_photo_id")
    .eq("id", vehicleId)
    .maybeSingle();

  return {
    cleared:
      !response.error &&
      Boolean(response.data?.id) &&
      response.data.primary_photo_id === null,
    error: response.error ?? null,
  };
}

export async function cleanupSoldVehiclePhotosWithClient({
  client,
  saleId,
  vehicleId,
} = {}) {
  const summary = createCleanupSummary();
  const normalizedSaleId = String(saleId ?? "").trim();
  const normalizedVehicleId = String(vehicleId ?? "").trim();

  if (!normalizedSaleId || !normalizedVehicleId) {
    summary.error = new Error(
      "A saved sale and vehicle are required for sold photo cleanup."
    );
    summary.failedCount = 1;
    return summary;
  }

  try {
    const saleResponse = await client
      .from("sales")
      .select("id, vehicle_id")
      .eq("id", normalizedSaleId)
      .eq("vehicle_id", normalizedVehicleId)
      .maybeSingle();

    if (saleResponse.error || !saleResponse.data) {
      summary.error =
        saleResponse.error ??
        new Error("The saved sale could not be verified for photo cleanup.");
      summary.failedCount = 1;
      return summary;
    }

    const initialPhotosResponse = await fetchVehiclePhotoRows(
      client,
      normalizedVehicleId
    );
    const primaryCleanup = await clearPrimaryPhoto(client, normalizedVehicleId);
    summary.primaryPhotoCleared = primaryCleanup.cleared;
    summary.error = initialPhotosResponse.error ?? primaryCleanup.error ?? null;

    if (initialPhotosResponse.error) {
      summary.failedCount = 1;
      return summary;
    }

    const initialPhotos = initialPhotosResponse.data;
    const initialPhotoIds = new Set(
      initialPhotos.map((photo) => photo?.id).filter(Boolean)
    );
    const cleanupPlan = getSoldVehiclePhotoCleanupPlan({
      photos: initialPhotos,
      vehicleId: normalizedVehicleId,
    });

    if (cleanupPlan.databaseOnlyPhotoIds.length > 0) {
      const deleteError = await deletePhotoRows(
        client,
        cleanupPlan.databaseOnlyPhotoIds
      );

      if (deleteError && !summary.error) {
        summary.error = deleteError;
      }
    }

    for (const [storagePath, pathPhotos] of cleanupPlan.photosByStoragePath) {
      const validation = await validateStoragePathReferences({
        client,
        pathPhotos,
        storagePath,
      });

      if (validation.error || !validation.isSafe) {
        summary.error =
          summary.error ??
          validation.error ??
          new Error("A vehicle photo has another active reference.");
        continue;
      }

      const storageError = await removeStoragePath(client, storagePath);

      if (storageError) {
        summary.error = summary.error ?? storageError;
        continue;
      }

      const deleteError = await deletePhotoRows(
        client,
        pathPhotos.map((photo) => photo.id)
      );

      if (deleteError && !summary.error) {
        summary.error = deleteError;
      }
    }

    const [remainingPhotosResponse, primaryVerification] = await Promise.all([
      fetchVehiclePhotoRows(client, normalizedVehicleId),
      verifyPrimaryPhotoCleared(client, normalizedVehicleId),
    ]);

    if (remainingPhotosResponse.error && !summary.error) {
      summary.error = remainingPhotosResponse.error;
    }
    if (primaryVerification.error && !summary.error) {
      summary.error = primaryVerification.error;
    }

    summary.primaryPhotoCleared = primaryVerification.cleared;

    if (remainingPhotosResponse.error) {
      summary.failedCount = Math.max(1, cleanupPlan.unsafePhotoIds.length);
      return summary;
    }

    const remainingPhotoIds = new Set(
      remainingPhotosResponse.data.map((photo) => photo?.id).filter(Boolean)
    );
    summary.deletedPhotoIds = [...initialPhotoIds].filter(
      (photoId) => !remainingPhotoIds.has(photoId)
    );
    summary.deletedCount = summary.deletedPhotoIds.length;
    summary.failedCount =
      remainingPhotoIds.size + (summary.primaryPhotoCleared ? 0 : 1);
    summary.completed =
      summary.failedCount === 0 && remainingPhotosResponse.data.length === 0;
    summary.warning = summary.completed ? "" : SOLD_PHOTO_CLEANUP_WARNING;

    if (summary.completed) {
      summary.error = null;
    }

    return summary;
  } catch (error) {
    console.error("Sold vehicle photo cleanup failed:", error);
    summary.error = error;
    summary.failedCount = Math.max(1, summary.failedCount);
    return summary;
  }
}
