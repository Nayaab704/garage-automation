import { cleanupSoldVehiclePhotosWithClient } from "./soldVehiclePhotoCleanup";
import { supabase } from "./supabaseClient";

export function cleanupSoldVehiclePhotos(options = {}) {
  return cleanupSoldVehiclePhotosWithClient({
    ...options,
    client: supabase,
  });
}
