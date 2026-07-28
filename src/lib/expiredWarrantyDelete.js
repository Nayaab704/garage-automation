import { supabase } from "./supabaseClient";
import {
  fetchWarrantyRegisterData,
  getVehicleArchiveRecordFingerprint,
} from "./warrantyRegister";

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

      console.warn(`Expired vehicle storage cleanup failed for ${bucketName}:`, {
        error,
        paths: batch,
      });
      failedPaths.push(...batch);
    } catch (error) {
      console.warn(`Expired vehicle storage cleanup threw for ${bucketName}:`, {
        error,
        paths: batch,
      });
      failedPaths.push(...batch);
    }
  }

  return {
    failedCount: failedPaths.length,
  };
}

function logDeleteError(context, error) {
  console.error(context, {
    code: error?.code ?? null,
    details: error?.details ?? null,
    error,
    hint: error?.hint ?? null,
    message: error?.message ?? null,
  });
}

function getFriendlyDeleteError(error, { storageRemoved = false } = {}) {
  const message = String(error?.message ?? "").toLowerCase();

  if (storageRemoved) {
    return "Stored files were removed, but the vehicle records could not be deleted. Refresh and try Delete From App again.";
  }

  if (error?.code === "42501" || message.includes("admin or manager")) {
    return "Only an active admin or manager can delete expired warranty vehicles.";
  }

  if (
    message.includes("coverage changed") ||
    message.includes("record changed") ||
    error?.code === "40001"
  ) {
    return "The sale or warranty changed. Download a new Archive CSV before deleting.";
  }

  if (
    message.includes("not sold") ||
    message.includes("no expired warranty") ||
    message.includes("active warranty") ||
    message.includes("before today")
  ) {
    return "Only sold vehicles with a warranty end date before today can be deleted.";
  }

  if (error?.code === "P0002" || message.includes("not found")) {
    return "Vehicle not found or deleted.";
  }

  return "Could not delete the vehicle. Refresh the cleanup list and try again.";
}

function getExpectedValues({ saleId, vehicleId, warrantyEndDate, warrantyId }) {
  return {
    p_expected_sale_id: String(saleId ?? "").trim() || null,
    p_expected_warranty_end_date:
      String(warrantyEndDate ?? "").trim().slice(0, 10) || null,
    p_expected_warranty_id: String(warrantyId ?? "").trim() || null,
    p_vehicle_id: String(vehicleId ?? "").trim() || null,
  };
}

async function verifyCurrentArchiveRecord(options, rpcValues) {
  const expectedFingerprint = options?.archiveRecord
    ? getVehicleArchiveRecordFingerprint(options.archiveRecord)
    : "";

  if (!expectedFingerprint) {
    return new Error(
      "Download a current Archive CSV before deleting this vehicle."
    );
  }

  try {
    const { data, error, warning } = await fetchWarrantyRegisterData({
      includeInvestment: true,
    });

    if (error) {
      logDeleteError("Could not verify the exported vehicle record", error);
      return new Error(
        "Could not verify the downloaded Archive CSV. Refresh and try again."
      );
    }

    if (warning) {
      console.warn("Could not fully verify the exported vehicle record:", {
        warning,
      });
      return new Error(
        "Some archive details could not be verified. Close this window, press Refresh, and try again."
      );
    }

    const currentRecord = (data ?? []).find(
      (record) => record.vehicleId === rpcValues.p_vehicle_id
    );

    if (
      !currentRecord?.isExpiredCleanupEligible ||
      getVehicleArchiveRecordFingerprint(currentRecord) !==
        expectedFingerprint
    ) {
      return new Error(
        "Vehicle details or warranty coverage changed. Close this window, press Refresh, and download a new Archive CSV."
      );
    }

    return null;
  } catch (error) {
    logDeleteError("Could not verify the exported vehicle record", error);
    return new Error(
      "Could not verify the downloaded Archive CSV. Refresh and try again."
    );
  }
}

export async function deleteExpiredWarrantyVehicle(options) {
  const rpcValues = getExpectedValues(options);

  if (
    !rpcValues.p_vehicle_id ||
    !rpcValues.p_expected_sale_id ||
    !rpcValues.p_expected_warranty_id ||
    !rpcValues.p_expected_warranty_end_date
  ) {
    return {
      data: null,
      error: new Error(
        "Download a current Archive CSV before deleting this vehicle."
      ),
    };
  }

  const verificationError = await verifyCurrentArchiveRecord(
    options,
    rpcValues
  );

  if (verificationError) {
    return {
      data: null,
      error: verificationError,
    };
  }

  let prepareResponse;

  try {
    prepareResponse = await supabase.rpc(
      "prepare_expired_warranty_vehicle_delete",
      rpcValues
    );
  } catch (error) {
    logDeleteError(
      "Could not prepare expired warranty vehicle deletion",
      error
    );
    return {
      data: null,
      error: new Error(getFriendlyDeleteError(error)),
    };
  }

  if (prepareResponse.error) {
    logDeleteError(
      "Could not prepare expired warranty vehicle deletion",
      prepareResponse.error
    );
    return {
      data: null,
      error: new Error(getFriendlyDeleteError(prepareResponse.error)),
    };
  }

  const preparedRecord = Array.isArray(prepareResponse.data)
    ? prepareResponse.data[0]
    : prepareResponse.data;

  if (!preparedRecord?.prepared_vehicle_id) {
    return {
      data: null,
      error: new Error(
        "Could not prepare the vehicle files for deletion. Refresh and try again."
      ),
    };
  }

  if (
    preparedRecord.prepared_vehicle_id !== rpcValues.p_vehicle_id ||
    preparedRecord.current_sale_id !== rpcValues.p_expected_sale_id ||
    preparedRecord.current_warranty_id !==
      rpcValues.p_expected_warranty_id ||
    String(preparedRecord.current_warranty_end_date ?? "").slice(0, 10) !==
      rpcValues.p_expected_warranty_end_date
  ) {
    return {
      data: null,
      error: new Error(
        "The prepared sale or warranty did not match the downloaded Archive CSV. Refresh and try again."
      ),
    };
  }

  const preparedPhotoPaths = uniquePaths(preparedRecord.photo_paths ?? []);
  const preparedDocumentPaths = uniquePaths(
    preparedRecord.document_paths ?? []
  );
  const [photoCleanup, documentCleanup] = await Promise.all([
    removeStorageFiles("vehicle-photos", preparedPhotoPaths),
    removeStorageFiles("vehicle-documents", preparedDocumentPaths),
  ]);
  const failedStorageCount =
    photoCleanup.failedCount + documentCleanup.failedCount;

  if (failedStorageCount > 0) {
    return {
      data: null,
      error: new Error(
        `${failedStorageCount} stored ${
          failedStorageCount === 1 ? "file could" : "files could"
        } not be removed. Vehicle records were kept so cleanup can be retried.`
      ),
    };
  }

  let deleteResponse;
  const deleteRpcValues = {
    ...rpcValues,
    p_expected_document_paths: preparedDocumentPaths,
    p_expected_photo_paths: preparedPhotoPaths,
  };

  try {
    deleteResponse = await supabase.rpc(
      "delete_expired_warranty_vehicle",
      deleteRpcValues
    );
  } catch (error) {
    logDeleteError(
      "Could not delete prepared expired warranty vehicle",
      error
    );
    return {
      data: null,
      error: new Error(
        getFriendlyDeleteError(error, {
          storageRemoved: true,
        })
      ),
    };
  }

  if (deleteResponse.error) {
    logDeleteError(
      "Could not delete prepared expired warranty vehicle",
      deleteResponse.error
    );
    return {
      data: null,
      error: new Error(
        getFriendlyDeleteError(deleteResponse.error, {
          storageRemoved: true,
        })
      ),
    };
  }

  const deletedRecord = Array.isArray(deleteResponse.data)
    ? deleteResponse.data[0]
    : deleteResponse.data;

  if (!deletedRecord?.deleted_vehicle_id) {
    return {
      data: null,
      error: new Error(
        "Vehicle files were removed, but the delete result could not be confirmed. Refresh the app before trying again."
      ),
    };
  }

  return {
    data: deletedRecord,
    error: null,
  };
}
