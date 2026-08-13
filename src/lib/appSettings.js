import { supabase } from "./supabaseClient";

export const DEFAULT_PO_SHIPPING_COST_KEY = "default_po_shipping_cost";
export const DEFAULT_PO_SHIPPING_COST_FALLBACK = 0;
export const PO_SHIPPING_QUICK_OPTIONS = [0, 50, 100, 150];

export function normalizeDefaultPoShippingCost(value) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue >= 0
    ? numberValue
    : DEFAULT_PO_SHIPPING_COST_FALLBACK;
}

export async function fetchDefaultPoShippingCost() {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", DEFAULT_PO_SHIPPING_COST_KEY)
      .maybeSingle();

    return {
      data: normalizeDefaultPoShippingCost(data?.value),
      error,
    };
  } catch (error) {
    return {
      data: DEFAULT_PO_SHIPPING_COST_FALLBACK,
      error,
    };
  }
}

export async function updateDefaultPoShippingCost({
  currentProfileId,
  value,
}) {
  const shippingCost = normalizeDefaultPoShippingCost(value);

  return supabase
    .from("app_settings")
    .upsert(
      {
        key: DEFAULT_PO_SHIPPING_COST_KEY,
        updated_at: new Date().toISOString(),
        updated_by: currentProfileId ?? null,
        value: shippingCost,
      },
      { onConflict: "key" }
    )
    .select("key, value, updated_by, updated_at")
    .single();
}
