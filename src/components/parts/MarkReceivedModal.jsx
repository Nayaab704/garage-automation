import ModalShell from "../ui/ModalShell";
import { buttonClassNames } from "../ui/uiStyles";

function getPurchaseOrderLabel(purchaseOrder) {
  return `PO ${String(purchaseOrder?.id ?? "").slice(0, 8).toUpperCase()}`;
}

function MarkReceivedModal({
  isSubmitting,
  onClose,
  onConfirm,
  purchaseOrder,
  subtitle = "",
}) {
  const subtitleText =
    subtitle || purchaseOrder?.vendor?.name || "Unknown vendor";

  return (
    <ModalShell
      description="This updates the purchase order, linked items, and linked part request status."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      title="Mark this purchase order as received?"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-950">
            {getPurchaseOrderLabel(purchaseOrder)}
          </p>
          <p className="mt-1 text-sm text-slate-600">{subtitleText}</p>
        </div>

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
            onClick={onConfirm}
            type="button"
          >
            {isSubmitting ? "Marking received..." : "Mark Received"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export default MarkReceivedModal;
