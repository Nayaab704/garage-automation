import { isPurchaseOrderItemReturned } from "./partReturns";
import { supabase } from "./supabaseClient";

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

export function getPurchaseOrderReceivedValues(purchaseOrder, currentProfile) {
  return {
    received_at: purchaseOrder?.received_at ?? new Date().toISOString(),
    received_by: currentProfile?.id ?? purchaseOrder?.received_by ?? null,
    status: "received",
  };
}

export function getReceivablePurchaseOrderItems(items = []) {
  return items.filter((item) => !isPurchaseOrderItemReturned(item));
}

export async function markPurchaseOrderReceived({
  currentProfile = null,
  linkedItems = [],
  purchaseOrder,
} = {}) {
  if (!purchaseOrder?.id) {
    return {
      data: null,
      error: new Error("Missing purchase order."),
    };
  }

  const receivedValues = getPurchaseOrderReceivedValues(
    purchaseOrder,
    currentProfile
  );
  const purchaseOrderUpdate = { status: "received" };

  if (!purchaseOrder.received_at) {
    purchaseOrderUpdate.received_at = receivedValues.received_at;
  }

  if (currentProfile?.id) {
    purchaseOrderUpdate.received_by = currentProfile.id;
  }

  const purchaseOrderResponse = await supabase
    .from("purchase_orders")
    .update(purchaseOrderUpdate)
    .eq("id", purchaseOrder.id)
    .select("*")
    .single();

  if (purchaseOrderResponse.error) {
    return { data: null, error: purchaseOrderResponse.error };
  }

  const receivableItems = getReceivablePurchaseOrderItems(linkedItems);
  const itemIds = receivableItems.map((item) => item.id).filter(Boolean);
  const partRequestIds = uniqueValues(
    receivableItems.map((item) => item.part_request_id)
  );
  let purchaseOrderItems = [];
  let partRequests = [];

  if (itemIds.length > 0) {
    const itemResponse = await supabase
      .from("purchase_order_items")
      .update({ status: "received" })
      .in("id", itemIds)
      .select("*");

    if (itemResponse.error) {
      return { data: null, error: itemResponse.error };
    }

    purchaseOrderItems =
      itemResponse.data ??
      receivableItems.map((item) => ({ ...item, status: "received" }));
  }

  if (partRequestIds.length > 0) {
    const partRequestResponse = await supabase
      .from("part_requests")
      .update({ status: "received" })
      .in("id", partRequestIds)
      .select("*");

    if (partRequestResponse.error) {
      return { data: null, error: partRequestResponse.error };
    }

    partRequests =
      partRequestResponse.data ??
      partRequestIds.map((partRequestId) => ({
        id: partRequestId,
        status: "received",
      }));
  }

  return {
    data: {
      itemIds,
      partRequestIds,
      partRequests,
      purchaseOrder: {
        ...purchaseOrder,
        ...receivedValues,
        ...(purchaseOrderResponse.data ?? {}),
      },
      purchaseOrderItems,
      receivedAt: receivedValues.received_at,
      receivedBy: receivedValues.received_by,
    },
    error: null,
  };
}
