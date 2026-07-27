import { supabase } from "./supabaseClient";

export async function logVehicleActivity({
  action,
  details = {},
  userId = null,
  vehicleId,
}) {
  if (!vehicleId || !action) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("activity_logs")
      .insert([
        {
          vehicle_id: vehicleId,
          user_id: userId,
          action,
          details: details && typeof details === "object" ? details : {},
        },
      ])
      .select("id, vehicle_id, action, details, created_at")
      .single();

    if (error) {
      console.error("Unable to log vehicle activity:", error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error(
      "Unable to log vehicle activity:",
      error?.message ?? error
    );
    return null;
  }
}
