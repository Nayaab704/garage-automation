import { useState } from "react";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { buttonClassNames } from "../ui/uiStyles";
import { logVehicleActivity } from "../../lib/activityLogger";
import {
  getPurchaseOrderItemGrossTotal,
  getPurchaseOrderItemSubtotal,
} from "../../lib/partReturns";
import { supabase } from "../../lib/supabaseClient";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

function numberOrZero(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getQuantity(value) {
  if (value === null || value === undefined || value === "") {
    return 1;
  }

  return numberOrZero(value);
}

function formatCurrency(value) {
  return currencyFormatter.format(numberOrZero(value));
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="font-black tabular-nums text-slate-950">{value}</span>
    </div>
  );
}

function MarkReturnedModal({
  currentProfile,
  item,
  onClose,
  onReturned,
  purchaseOrder,
  vehicleId,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const subtotal = getPurchaseOrderItemSubtotal(item);
  const shipping = numberOrZero(item?.shipping_cost);
  const tax = numberOrZero(item?.tax);
  const totalDeduction = getPurchaseOrderItemGrossTotal(item);

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const returnedAt = new Date().toISOString();
      const updateValues = {
        return_notes: null,
        return_reason: null,
        return_status: "returned",
        returned_amount: subtotal + tax,
        returned_at: returnedAt,
        returned_by: currentProfile?.id ?? null,
        returned_quantity: getQuantity(item?.quantity),
        returned_shipping_amount: shipping,
        status: "returned",
      };

      const { data, error } = await supabase
        .from("purchase_order_items")
        .update(updateValues)
        .eq("id", item.id)
        .select("*")
        .single();

      if (error) {
        console.error("Could not mark part returned:", error);
        setErrorMessage("Could not mark part as returned. Please try again.");
        return;
      }

      const activityVehicleId = vehicleId ?? purchaseOrder?.vehicle_id;

      if (activityVehicleId) {
        await logVehicleActivity({
          vehicleId: activityVehicleId,
          action: "Part returned",
          details: {
            description: item.description,
            purchase_order_id: purchaseOrder?.id ?? item.purchase_order_id,
            returned_amount: updateValues.returned_amount,
            returned_quantity: updateValues.returned_quantity,
            returned_shipping_amount: updateValues.returned_shipping_amount,
            total_deduction: totalDeduction,
          },
        });
      }

      await onReturned?.(data ?? { ...item, ...updateValues });
      onClose?.();
    } catch (error) {
      console.error("Could not mark part returned:", error);
      setErrorMessage("Could not mark part as returned. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="This will mark the part as returned and remove this purchase cost from the vehicle total."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      title="Mark Part Returned?"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-950">
            {item?.description || "Unnamed part"}
          </p>
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <SummaryRow label="Part subtotal" value={formatCurrency(subtotal)} />
          <SummaryRow label="Shipping" value={formatCurrency(shipping)} />
          <SummaryRow label="Tax" value={formatCurrency(tax)} />
          <SummaryRow
            label="Total deduction"
            value={formatCurrency(totalDeduction)}
          />
        </div>

        <FormMessage>{errorMessage}</FormMessage>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <button
            className={`w-full sm:w-auto ${buttonClassNames.secondary}`}
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className={`w-full sm:w-auto ${buttonClassNames.primary}`}
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Marking returned..." : "Mark Returned"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export default MarkReturnedModal;
