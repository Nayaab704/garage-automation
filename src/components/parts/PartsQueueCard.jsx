import {
  approvalLabels,
  formatPartLabel,
  formatPartQueueVehicleLabel,
  getPartEstimatedTotal,
  getPartQueueBadge,
  getPartQueueStatus,
  getPrimaryPurchaseOrderItem,
  getSelectedUnitCost,
  getSelectedVendorName,
  isPartNeedsPo,
  isPartPendingReview,
  partSourceLabels,
} from "../../lib/partWorkflowUtils";
import AppIcon from "../ui/AppIcon";
import { buttonClassNames } from "../ui/uiStyles";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US");

function formatCurrency(value) {
  const numberValue = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(numberValue) ? numberValue : 0);
}

function formatNumber(value) {
  const numberValue = Number(value ?? 0);
  return numberFormatter.format(Number.isFinite(numberValue) ? numberValue : 0);
}

function getPurchaseOrderStatus(part) {
  const primaryPurchaseOrderItem = getPrimaryPurchaseOrderItem(part);
  return primaryPurchaseOrderItem?.purchaseOrder?.status ?? primaryPurchaseOrderItem?.status;
}

function Badge({ children, className }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-black ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function PartsQueueCard({
  canApproveParts,
  canCreatePurchaseOrders,
  isUpdating,
  onApprove,
  onCreatePurchaseOrder,
  onOpenPurchaseOrders,
  onOpenVehicle,
  onReject,
  onViewPrices,
  part,
}) {
  const queueStatus = getPartQueueStatus(part);
  const queueBadge = getPartQueueBadge(queueStatus);
  const vendorLabel = getSelectedVendorName(part);
  const purchaseOrderStatus = getPurchaseOrderStatus(part);
  const selectedQuote = part.selectedQuote;
  const workOrder = part.repairJob;
  const serviceCategory =
    workOrder?.serviceCategory?.name ||
    formatPartLabel(workOrder?.category, {});
  const canCreatePoForPart = canCreatePurchaseOrders && isPartNeedsPo(part);
  const canApprovePart =
    canApproveParts &&
    part.part_source === "needs_to_buy" &&
    part.approval_status === "pending";
  const quantityLabel = formatNumber(part.quantity || 1);
  const unitPriceLabel = formatCurrency(getSelectedUnitCost(part));
  const totalLabel = formatCurrency(getPartEstimatedTotal(part));

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 text-lg font-black leading-snug text-slate-950">
              {part.part_name || "Unnamed part"}
            </h3>
            <Badge className={`${queueBadge.className} shrink-0`}>
              {queueBadge.label}
            </Badge>
          </div>

          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <p className="font-black text-slate-900">
              {formatPartQueueVehicleLabel(part)}
            </p>
            <p>
              <span className="font-semibold text-slate-800">
                {serviceCategory}
              </span>
              {workOrder?.title ? ` - ${workOrder.title}` : ""}
            </p>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
            {vendorLabel ? (
              <>
                <p className="text-sm font-black text-slate-950">
                  {vendorLabel}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {unitPriceLabel} each - Qty {quantityLabel} - Total {totalLabel}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-black text-amber-800">
                  No vendor selected
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Use View Prices to select a saved vendor price, or create a PO manually.
                </p>
              </>
            )}
            {purchaseOrderStatus && (
              <p className="mt-1 text-xs font-semibold text-slate-500">
                PO status: {formatPartLabel(purchaseOrderStatus, {})}
              </p>
            )}
            {!purchaseOrderStatus && selectedQuote && (
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                Selected vendor price is ready for PO.
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
              {formatPartLabel(part.part_source, partSourceLabels)}
            </Badge>
            <Badge
              className={
                part.approval_status === "rejected"
                  ? "bg-red-50 text-red-700 ring-red-200"
                  : part.approval_status === "pending"
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200"
              }
            >
              {formatPartLabel(part.approval_status, approvalLabels)}
            </Badge>
          </div>

          {part.notes && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-500">
              {part.notes}
            </p>
          )}

          {isPartPendingReview(part) && canCreatePoForPart && (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              Pending admin review. PO creation is still allowed.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:w-48 lg:flex-col lg:items-stretch">
          {canCreatePoForPart ? (
            <button
              className={`${buttonClassNames.primary} flex-1 lg:w-full`}
              onClick={() => onCreatePurchaseOrder(part)}
              type="button"
            >
              <AppIcon name="plus" size={16} />
              Create PO
            </button>
          ) : purchaseOrderStatus ? (
            <button
              className={`${buttonClassNames.secondary} flex-1 lg:w-full`}
              onClick={onOpenPurchaseOrders}
              type="button"
            >
              Open POs
            </button>
          ) : null}

          <button
            className={`${buttonClassNames.secondary} flex-1 lg:w-full`}
            onClick={() => onViewPrices(part)}
            type="button"
          >
            View Prices
          </button>

          <button
            className={`${buttonClassNames.secondary} flex-1 lg:w-full`}
            disabled={!part.vehicle_id}
            onClick={() => onOpenVehicle?.(part.vehicle_id)}
            type="button"
          >
            Open Vehicle
          </button>

          {canApprovePart && (
            <div className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-2">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Review actions
              </p>
              <div className="flex gap-2 lg:flex-col">
                <button
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={isUpdating}
                  onClick={() => onApprove(part)}
                  type="button"
                >
                  {isUpdating ? "Saving..." : "Approve"}
                </button>
                <button
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm font-black text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isUpdating}
                  onClick={() => onReject(part)}
                  type="button"
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default PartsQueueCard;
