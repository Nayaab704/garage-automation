import { supabase } from "./supabaseClient";

const STORAGE_DELETE_BATCH_SIZE = 100;

function uniquePaths(paths = []) {
  return [
    ...new Set(
      paths
        .map((path) => String(path ?? "").trim())
        .filter((path) => path.length > 0)
    ),
  ];
}

function normalizeStoragePath(value, bucketName) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return "";
  }

  if (!/^https?:\/\//i.test(rawValue)) {
    return rawValue.replace(/^\/+/, "");
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

    const encodedPath = url.pathname.split(marker)[1] ?? "";

    return decodeURIComponent(encodedPath).replace(/^\/+/, "");
  } catch {
    return "";
  }
}

async function removeStorageFiles(bucketName, rawPaths = []) {
  const uniqueRawPaths = uniquePaths(rawPaths);
  const normalizedPaths = uniqueRawPaths.map((path) => ({
    normalizedPath: normalizeStoragePath(path, bucketName),
    rawPath: path,
  }));
  const paths = uniquePaths(
    normalizedPaths.map(({ normalizedPath }) => normalizedPath)
  );
  const failedPaths = normalizedPaths
    .filter(({ normalizedPath }) => !normalizedPath)
    .map(({ rawPath }) => rawPath);

  for (
    let startIndex = 0;
    startIndex < paths.length;
    startIndex += STORAGE_DELETE_BATCH_SIZE
  ) {
    const batch = paths.slice(
      startIndex,
      startIndex + STORAGE_DELETE_BATCH_SIZE
    );
    try {
      const { error } = await supabase.storage.from(bucketName).remove(batch);

      if (!error) {
        continue;
      }

      console.warn(`Archive storage cleanup failed for ${bucketName}:`, {
        error,
        paths: batch,
      });
      failedPaths.push(...batch);
    } catch (error) {
      console.warn(`Archive storage cleanup threw for ${bucketName}:`, {
        error,
        paths: batch,
      });
      failedPaths.push(...batch);
    }
  }

  return {
    attemptedCount: uniqueRawPaths.length,
    failedCount: failedPaths.length,
  };
}

function getFriendlyArchiveError(error) {
  const message = String(error?.message ?? "").toLowerCase();

  if (error?.code === "42501" || message.includes("admin or manager")) {
    return "Only an active admin or manager can archive expired warranty vehicles.";
  }

  if (message.includes("already archived")) {
    return "This vehicle has already been archived.";
  }

  if (
    message.includes("warranty coverage changed") ||
    error?.code === "40001"
  ) {
    return "Warranty coverage changed. Refresh and export the current vehicle record before archiving.";
  }

  if (
    message.includes("not sold") ||
    message.includes("no expired warranty") ||
    message.includes("before today")
  ) {
    return "Only sold vehicles with a warranty end date before today can be archived.";
  }

  if (error?.code === "P0002" || message.includes("not found")) {
    return "Vehicle not found or archived.";
  }

  if (
    message.includes("foreign key") ||
    message.includes("violates")
  ) {
    return "The vehicle could not be archived because linked records still need review.";
  }

  return "Could not archive and delete the vehicle. Please try again.";
}

async function markStorageCleanupStatus(archiveId, failedCount) {
  try {
    const response = await supabase.rpc(
      "mark_vehicle_archive_storage_cleanup",
      {
        p_archive_id: archiveId,
        p_failed_count: failedCount,
      }
    );

    if (response.error) {
      console.warn("Could not save archive storage cleanup status:", {
        archiveId,
        error: response.error,
        failedCount,
      });
    }

    return response;
  } catch (error) {
    console.warn("Archive storage cleanup status update threw:", {
      archiveId,
      error,
      failedCount,
    });
    return { data: null, error };
  }
}

async function runExpiredWarrantyArchive({
  isStorageRetry = false,
  vehicleId,
  warrantyEndDate = null,
  warrantyId = null,
}) {
  if (!vehicleId) {
    return {
      data: null,
      error: new Error("A vehicle ID is required before archiving."),
      storageWarning: "",
    };
  }

  const normalizedWarrantyId = String(warrantyId ?? "").trim();
  const normalizedWarrantyEndDate = String(warrantyEndDate ?? "")
    .trim()
    .slice(0, 10);

  if (
    !isStorageRetry &&
    (!normalizedWarrantyId || !normalizedWarrantyEndDate)
  ) {
    return {
      data: null,
      error: new Error(
        "Refresh and export the current warranty record before archiving."
      ),
      storageWarning: "",
    };
  }

  const { data, error } = await supabase.rpc(
    "archive_expired_warranty_vehicle",
    {
      p_expected_warranty_end_date: normalizedWarrantyEndDate || null,
      p_expected_warranty_id: normalizedWarrantyId || null,
      p_vehicle_id: vehicleId,
    }
  );

  if (error) {
    console.error("Expired warranty archive RPC failed:", {
      code: error.code ?? null,
      details: error.details ?? null,
      error,
      hint: error.hint ?? null,
      message: error.message ?? null,
    });

    const friendlyError = new Error(getFriendlyArchiveError(error));
    friendlyError.code = error.code;
    return { data: null, error: friendlyError, storageWarning: "" };
  }

  const archiveResult = Array.isArray(data) ? data[0] : data;

  if (!archiveResult?.archive_id || !archiveResult?.archived_vehicle_id) {
    console.error("Expired warranty archive RPC returned no archive record:", {
      data,
      vehicleId,
    });
    return {
      data: null,
      error: new Error(
        "The archive operation did not return a saved record. Please refresh before trying again."
      ),
      storageWarning: "",
    };
  }

  const [photoCleanup, documentCleanup] = await Promise.all([
    removeStorageFiles("vehicle-photos", archiveResult?.photo_paths ?? []),
    removeStorageFiles(
      "vehicle-documents",
      archiveResult?.document_paths ?? []
    ),
  ]);
  const failedStorageCount =
    photoCleanup.failedCount + documentCleanup.failedCount;
  const cleanupStatusResponse = await markStorageCleanupStatus(
    archiveResult.archive_id,
    failedStorageCount
  );
  const cleanupStatusRecord = Array.isArray(cleanupStatusResponse.data)
    ? cleanupStatusResponse.data[0]
    : cleanupStatusResponse.data;
  const storageWarnings = [];

  if (failedStorageCount > 0) {
    storageWarnings.push(
      `Vehicle was archived and removed from the app, but ${failedStorageCount} stored ${
        failedStorageCount === 1 ? "file" : "files"
      } could not be removed automatically. Use Retry File Cleanup from Archived Records.`
    );
  }

  if (cleanupStatusResponse.error) {
    storageWarnings.push(
      "The file cleanup result could not be saved. Use Retry File Cleanup from Archived Records."
    );
  }

  return {
    data: {
      ...archiveResult,
      archive_record: cleanupStatusRecord ?? archiveResult.archive_record,
    },
    error: null,
    storageWarning: storageWarnings.join(" "),
  };
}

export function archiveExpiredWarrantyVehicle(options) {
  return runExpiredWarrantyArchive(options);
}

export function retryArchivedWarrantyStorageCleanup({ vehicleId }) {
  return runExpiredWarrantyArchive({
    isStorageRetry: true,
    vehicleId,
  });
}
