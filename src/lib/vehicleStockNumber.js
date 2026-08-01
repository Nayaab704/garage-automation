export const nextVehicleStockNumberRpc = "get_next_vehicle_stock_number";

export function normalizeVehicleStockNumber(value) {
  const stockNumber = String(value ?? "").trim().toUpperCase();
  return /^STK-[1-9][0-9]*$/.test(stockNumber) ? stockNumber : "";
}

export async function fetchNextVehicleStockNumber(supabaseClient) {
  if (!supabaseClient?.rpc) {
    return {
      data: "",
      error: new Error("Stock number service is unavailable."),
    };
  }

  try {
    const { data, error } = await supabaseClient.rpc(nextVehicleStockNumberRpc);

    if (error) {
      return { data: "", error };
    }

    const stockNumber = normalizeVehicleStockNumber(data);

    if (!stockNumber) {
      return {
        data: "",
        error: new Error("The next stock number could not be calculated."),
      };
    }

    return { data: stockNumber, error: null };
  } catch (error) {
    return { data: "", error };
  }
}

export function isVehicleStockNumberConflict(error) {
  const constraint = String(error?.constraint ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();

  return (
    error?.code === "23505" &&
    (constraint.includes("stock_number") || message.includes("stock_number"))
  );
}
