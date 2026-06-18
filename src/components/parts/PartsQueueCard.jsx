import {
  approvalLabels,
  formatPartLabel,
  formatPartQueueVehicleLabel,
  getPartQueueBadge,
  getPartQueueStatus,
  getPrimaryPurchaseOrderItem,
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

function getPartTotal(part) {
  const quantity = Number(part.quantity || 0);
  const unitCost = Number(part.unit_cost || 0);

  if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) {
    return 0;
  }

  return quantity * unitCost;
}

function getVendorLabel(part) {
  const primaryPurchaseOrderItem = getPrimaryPurchaseOrderItem(part);

  if (primaryPurchaseOrderItem?.purchaseOrder?.vendor?.name) {
    return primaryPurchaseOrderItem.purchaseOrder.vendor.name;
  }

  if (part.latestQuote?.vendor_name_snapshot) {
    return part.latestQuote.vendor_name_snapshot;
  }

  return "";
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

function DetailPill({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-inset ring-slate-100">
      <AppIcon className="text-slate-400" name={icon} size={14} />
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
  const vendorLabel = getVendorLabel(part);
  const purchaseOrderStatus = getPurchaseOrderStatus(part);
  const workOrder = part.repairJob;
  const serviceCategory =
    workOrder?.serviceCategory?.name ||
    formatPartLabel(workOrder?.category, {});
  const canCreatePoForPart = canCreatePurchaseOrders && isPartNeedsPo(part);
  const canApprovePart =
    canApproveParts &&
    part.part_source === "needs_to_buy" &&
    part.approval_status === "pending";

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 text-lg font-black text-slate-950">
              {part.part_name || "Unnamed part"}
            </h3>
            <Badge className={queueBadge.className}>{queueBadge.label}</Badge>
          </div>

          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p className="font-black text-slate-900">
              {formatPartQueueVehicleLabel(part)}
            </p>
            <p>
              <span className="font-semibold text-slate-800">
                {serviceCategory}
              </span>
              {workOrder?.title ? ` · ${workOrder.title}` : ""}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <DetailPill icon="box">
              Qty {formatNumber(part.quantity || 1)}
            </DetailPill>
            <DetailPill icon="money">
              {formatCurrency(part.unit_cost)} each
            </DetailPill>
            <DetailPill icon="chart-up">
              Total {formatCurrency(getPartTotal(part))}
            </DetailPill>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
            {vendorLabel ? (
              <p className="text-sm font-bold text-slate-800">
                Vendor: <span className="text-slate-950">{vendorLabel}</span>
              </p>
            ) : (
              <p className="text-sm font-bold text-amber-800">
                No vendor selected
              </p>
            )}
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {purchaseOrderStatus
                ? `PO status: ${formatPartLabel(purchaseOrderStatus, {})}`
                : part.latestQuote
                  ? `Last quote: ${formatCurrency(part.latestQuote.unit_price)} each`
                  : "Use price history or create a PO when ready."}
            </p>
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
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Pending review, but your current workflow still allows PO creation.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-52 lg:flex-col lg:items-stretch">
          {canCreatePoForPart ? (
            <button
              className={buttonClassNames.primary}
              onClick={() => onCreatePurchaseOrder(part)}
              type="button"
            >
              <AppIcon name="plus" size={16} />
              Create PO
            </button>
          ) : purchaseOrderStatus ? (
            <button
              className={buttonClassNames.secondary}
              onClick={onOpenPurchaseOrders}
              type="button"
            >
              Open POs
            </button>
          ) : null}

          <button
            className={buttonClassNames.secondary}
            disabled={!part.vehicle_id}
            onClick={() => onOpenVehicle?.(part.vehicle_id)}
            type="button"
          >
            Open Vehicle
          </button>

          <button
            className={buttonClassNames.secondary}
            onClick={() => onViewPrices(part)}
            type="button"
          >
            View Prices
          </button>

          {canApprovePart && (
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
          )}
        </div>
      </div>
    </article>
  );
}

export default PartsQueueCard;
