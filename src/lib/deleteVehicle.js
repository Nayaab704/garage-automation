import { supabase } from "./supabaseClient";

function uniquePaths(paths = []) {
  return [
    ...new Set(
      paths
        .map((path) => String(path ?? "").trim())
        .filter((path) => path.length > 0)
    ),
  ];
}

function getFriendlyDeleteError(error) {
  const message = String(error?.message ?? "");

  if (message.toLowerCase().includes("admin")) {
    return "Only admin/manager can delete vehicles.";
  }

  if (message.toLowerCase().includes("not found")) {
    return "Vehicle could not be found.";
  }

  if (
    message.toLowerCase().includes("foreign key") ||
    message.toLowerCase().includes("violates")
  ) {
    return "Could not delete vehicle because related records still exist.";
  }

  return "Delete failed. Please try again.";
}

async function removeStorageFiles(bucketName, paths) {
  const uniqueStoragePaths = uniquePaths(paths);

  if (uniqueStoragePaths.length === 0) {
    return null;
  }

  const { error } = await supabase.storage
    .from(bucketName)
    .remove(uniqueStoragePaths);

  if (error) {
    console.warn(`Storage cleanup failed for ${bucketName}:`, error);
    return error;
  }

  return null;
}

export async function deleteVehicleCascade({
  documentPaths = [],
  photoPaths = [],
  vehicleId,
}) {
  if (!vehicleId) {
    return { error: new Error("Unable to delete a vehicle without an ID.") };
  }

  // The database RPC performs the permanent transactional delete and enforces
  // owner/admin access even if the frontend UI is bypassed.
  const { data, error } = await supabase.rpc("delete_vehicle_cascade", {
    p_vehicle_id: vehicleId,
  });

  if (error) {
    console.error("Vehicle delete RPC failed:", error);
    return { error: new Error(getFriendlyDeleteError(error)) };
  }

  const photoCleanupError = await removeStorageFiles(
    "vehicle-photos",
    photoPaths
  );
  const documentCleanupError = await removeStorageFiles(
    "vehicle-documents",
    documentPaths
  );
  const storageWarning =
    photoCleanupError || documentCleanupError
      ? "Vehicle was deleted, but some stored files could not be removed automatically."
      : "";

  return {
    data: Array.isArray(data) ? data[0] : data,
    error: null,
    storageWarning,
  };
}
