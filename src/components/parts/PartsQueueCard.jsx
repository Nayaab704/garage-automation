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
  isPartInHouse,
  isPartReturned,
  isPartNeedsPo,
  isPartPendingReview,
  partSourceLabels,
} from "../../lib/partWorkflowUtils";
import {
  getPartReturnDeduction,
  getPrimaryReturnedPurchaseOrderItem,
} from "../../lib/partReturns";
import { formatUserFirstName } from "../../lib/userDisplay";
import AppIcon from "../ui/AppIcon";

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

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getPurchaseOrderStatus(part) {
  const returnedPurchaseOrderItem = getPrimaryReturnedPurchaseOrderItem(part);

  if (returnedPurchaseOrderItem) {
    return "returned";
  }

  const primaryPurchaseOrderItem = getPrimaryPurchaseOrderItem(part);
  return primaryPurchaseOrderItem?.purchaseOrder?.status ?? primaryPurchaseOrderItem?.status;
}

function getReturnedAttributionText(
  returnedPurchaseOrderItem,
  { deduction = null, includeDeduction = false } = {}
) {
  if (!returnedPurchaseOrderItem) {
    return "";
  }

  const returnedName = returnedPurchaseOrderItem.returnedByProfile
    ? formatUserFirstName(returnedPurchaseOrderItem.returnedByProfile)
    : returnedPurchaseOrderItem.returned_by
      ? "User"
      : "";
  const returnedLabel = returnedName ? `Returned by ${returnedName}` : "Returned";
  const returnedDate = returnedPurchaseOrderItem.returned_at
    ? formatDate(returnedPurchaseOrderItem.returned_at)
    : "";
  const deductionText = includeDeduction
    ? `${formatCurrency(deduction)} deducted`
    : "";

  return [returnedLabel, returnedDate, deductionText].filter(Boolean).join(" - ");
}

function getPartAttributionText(part) {
  return [
    part.createdByProfile
      ? `Added by ${formatUserFirstName(part.createdByProfile)}`
      : "",
    part.created_at ? formatDate(part.created_at) : "",
    part.approvedByProfile && part.approved_at
      ? `Approved by ${formatUserFirstName(part.approvedByProfile)} ${formatDate(
          part.approved_at
        )}`
      : "",
  ]
    .filter(Boolean)
    .join(" - ");
}

function getVehicleLine(part) {
  return formatPartQueueVehicleLabel(part);
}

function getWorkOrderLine(workOrder, serviceCategory) {
  return [serviceCategory, workOrder?.title].filter(Boolean).join(" - ");
}

function getLifecycleAttributionText({
  part,
  primaryPurchaseOrderItem,
  returned,
  returnedPurchaseOrderItem,
}) {
  if (returned) {
    return getReturnedAttributionText(returnedPurchaseOrderItem) || "Returned";
  }

  const purchaseOrder = primaryPurchaseOrderItem?.purchaseOrder;

  if (purchaseOrder?.status === "received" || primaryPurchaseOrderItem?.status === "received") {
    const receivedName = purchaseOrder?.receivedByProfile
      ? formatUserFirstName(purchaseOrder.receivedByProfile)
      : purchaseOrder?.received_by
        ? "User"
        : "";
    const receivedLabel = receivedName
      ? `Received by ${receivedName}`
      : "Received";
    const receivedDate = purchaseOrder?.received_at
      ? formatDate(purchaseOrder.received_at)
      : "";

    return [receivedLabel, receivedDate].filter(Boolean).join(" - ");
  }

  if (purchaseOrder || primaryPurchaseOrderItem) {
    const orderedName = purchaseOrder?.orderedByProfile
      ? formatUserFirstName(purchaseOrder.orderedByProfile)
      : purchaseOrder?.ordered_by
        ? "User"
        : "";
    const orderedLabel = orderedName ? `Ordered by ${orderedName}` : "Ordered";
    const orderedDate = purchaseOrder?.ordered_at
      ? formatDate(purchaseOrder.ordered_at)
      : primaryPurchaseOrderItem?.created_at
        ? formatDate(primaryPurchaseOrderItem.created_at)
        : "";

    return [orderedLabel, orderedDate].filter(Boolean).join(" - ");
  }

  return getPartAttributionText(part);
}

function getSecondaryBadge(part, queueStatus) {
  if (part.approval_status === "rejected") {
    return {
      className: "bg-red-50 text-red-700 ring-red-200",
      label: formatPartLabel(part.approval_status, approvalLabels),
    };
  }

  if (part.approval_status === "pending" && queueStatus !== "pending_review") {
    return {
      className: "bg-amber-50 text-amber-800 ring-amber-200",
      label: formatPartLabel(part.approval_status, approvalLabels),
    };
  }

  if (part.part_source === "in_house" && queueStatus !== "in_house") {
    return {
      className: "bg-teal-50 text-teal-700 ring-teal-200",
      label: formatPartLabel(part.part_source, partSourceLabels),
    };
  }

  return null;
}

function Badge({ children, className }) {
  return (
    <span
      className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-black leading-none ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

const compactActionButtonClassName =
  "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

const primaryActionButtonClassName = `${compactActionButtonClassName} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-200 disabled:bg-slate-400`;
const secondaryActionButtonClassName = `${compactActionButtonClassName} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-200`;
const approveActionButtonClassName = `${compactActionButtonClassName} bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-200 disabled:bg-slate-300`;
const rejectActionButtonClassName = `${compactActionButtonClassName} border border-red-200 bg-white text-red-700 hover:bg-red-50 focus:ring-red-100`;

function PartsQueueCard({
  canApproveParts,
  canCreatePurchaseOrders,
  canMoveInHouseToNeedsPo = false,
  canManageReturns,
  isUpdating,
  onApprove,
  onCreatePurchaseOrder,
  onNeedToBuyInstead,
  onOpenPurchaseOrders,
  onOpenVehicle,
  onReject,
  onUndoReturn,
  onViewPrices,
  part,
}) {
  const queueStatus = getPartQueueStatus(part);
  const queueBadge = getPartQueueBadge(queueStatus);
  const returnedPurchaseOrderItem = getPrimaryReturnedPurchaseOrderItem(part);
  const returned = isPartReturned(part);
  const primaryPurchaseOrderItem = getPrimaryPurchaseOrderItem(part);
  const displayPurchaseOrderItem =
    primaryPurchaseOrderItem ?? returnedPurchaseOrderItem;
  const vendorLabel =
    getSelectedVendorName(part) ||
    returnedPurchaseOrderItem?.purchaseOrder?.vendor?.name;
  const purchaseOrderStatus = getPurchaseOrderStatus(part);
  const selectedQuote = part.selectedQuote;
  const workOrder = part.repairJob;
  const serviceCategory =
    workOrder?.serviceCategory?.name ||
    (workOrder?.category ? formatPartLabel(workOrder.category, {}) : "");
  const workOrderLine = getWorkOrderLine(workOrder, serviceCategory);
  const canCreatePoForPart = canCreatePurchaseOrders && isPartNeedsPo(part);
  const canMoveToNeedsPo = canMoveInHouseToNeedsPo && isPartInHouse(part);
  const canApprovePart =
    canApproveParts &&
    part.part_source === "needs_to_buy" &&
    part.approval_status === "pending";
  const quantityLabel = formatNumber(part.quantity || 1);
  const unitPriceLabel = formatCurrency(getSelectedUnitCost(part));
  const totalLabel = formatCurrency(getPartEstimatedTotal(part));
  const returnDeduction = getPartReturnDeduction(part);
  const returnedAttributionText = getReturnedAttributionText(
    returnedPurchaseOrderItem
  );
  const attributionText = getLifecycleAttributionText({
    part,
    primaryPurchaseOrderItem,
    returned,
    returnedPurchaseOrderItem,
  });
  const secondaryBadge = getSecondaryBadge(part, queueStatus);
  const purchaseOrderStatusLabel = purchaseOrderStatus
    ? formatPartLabel(purchaseOrderStatus, {})
    : "";
  const sourceLabel = formatPartLabel(part.part_source, partSourceLabels);

  return (
    <article
      className={`min-w-0 overflow-hidden rounded-2xl border bg-white p-3 shadow-sm sm:p-4 ${
        queueStatus === "in_house"
          ? "border-l-4 border-l-indigo-300 border-slate-200"
          : queueStatus === "needs_po"
            ? "border-l-4 border-l-amber-300 border-slate-200"
            : "border-slate-200"
      }`}
    >
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <h3 className="min-w-0 truncate text-lg font-black leading-tight text-slate-950 sm:text-xl">
              {part.part_name || "Unnamed part"}
            </h3>

            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              <Badge className={queueBadge.className}>{queueBadge.label}</Badge>
              {secondaryBadge && (
                <Badge className={secondaryBadge.className}>
                  {secondaryBadge.label}
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-2 space-y-1">
            <p className="flex min-w-0 items-center gap-1.5 text-sm font-black text-slate-800">
              <AppIcon
                className="shrink-0 text-slate-400"
                name="vehicle"
                size={15}
              />
              <span className="truncate">{getVehicleLine(part)}</span>
            </p>
            {workOrderLine && (
              <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-500 sm:text-sm">
                <AppIcon
                  className="shrink-0 text-slate-400"
                  name="wrench"
                  size={15}
                />
                <span className="truncate">{workOrderLine}</span>
              </p>
            )}
          </div>

          <div className="mt-3 space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 sm:text-sm">
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-bold text-slate-400">Vendor:</span>
              <span
                className={`min-w-0 max-w-full truncate font-black ${
                  vendorLabel ? "text-slate-900" : "text-amber-800"
                }`}
              >
                {vendorLabel || "No vendor selected"}
              </span>
              {purchaseOrderStatusLabel && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="font-bold text-slate-400">PO:</span>
                  <span className="font-black text-slate-800">
                    {purchaseOrderStatusLabel}
                  </span>
                </>
              )}
            </p>

            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                <span className="font-bold text-slate-400">Unit</span>{" "}
                <span className="font-black tabular-nums text-slate-950">
                  {unitPriceLabel}
                </span>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                <span className="font-bold text-slate-400">Qty</span>{" "}
                <span className="font-black tabular-nums text-slate-950">
                  {quantityLabel}
                </span>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                <span className="font-bold text-slate-400">Total</span>{" "}
                <span className="font-black tabular-nums text-slate-950">
                  {totalLabel}
                </span>
              </span>
              <span className="text-slate-300">|</span>
              <span className="min-w-0 truncate">
                <span className="font-bold text-slate-400">Source:</span>{" "}
                <span className="font-black text-slate-700">
                  {sourceLabel}
                </span>
              </span>
            </p>

            {returned && (
              <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-red-100 pt-1.5 text-xs font-semibold text-red-800">
                <span>
                  Returned qty{" "}
                  {formatNumber(
                    returnedPurchaseOrderItem?.returned_quantity ??
                      returnedPurchaseOrderItem?.quantity
                  )}
                </span>
                <span className="text-red-200">|</span>
                <span>
                  Unit {formatCurrency(returnedPurchaseOrderItem?.unit_cost)}
                </span>
                <span className="text-red-200">|</span>
                <span className="tabular-nums">
                  Deducted {formatCurrency(returnDeduction)}
                </span>
                <span className="text-red-200">|</span>
                <span>
                  Shipping{" "}
                  {formatCurrency(returnedPurchaseOrderItem?.shipping_cost)}
                </span>
                <span className="text-red-200">|</span>
                <span>Tax {formatCurrency(returnedPurchaseOrderItem?.tax)}</span>
                {(returnedAttributionText || returned) && (
                  <>
                    <span className="text-red-200">|</span>
                    <span>{returnedAttributionText || "Returned"}</span>
                  </>
                )}
              </p>
            )}

            {!purchaseOrderStatus && selectedQuote && (
              <p className="text-xs font-bold text-blue-700">
                Selected vendor price is ready for PO.
              </p>
            )}
          </div>

          {part.notes && (
            <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-500">
              {part.notes}
            </p>
          )}

          {isPartPendingReview(part) && canCreatePoForPart && (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              Pending admin review. PO creation is still allowed.
            </p>
          )}
        </div>

        <aside className="flex min-w-0 flex-wrap items-center gap-2 border-t border-slate-100 pt-3 lg:max-w-[18rem] lg:justify-end lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
          {canCreatePoForPart ? (
            <button
              className={primaryActionButtonClassName}
              onClick={() => onCreatePurchaseOrder(part)}
              type="button"
            >
              <AppIcon name="plus" size={15} />
              Create PO
            </button>
          ) : purchaseOrderStatus ? (
            <button
              className={secondaryActionButtonClassName}
              onClick={() =>
                onOpenPurchaseOrders?.({
                  itemId: displayPurchaseOrderItem?.id,
                  poId: displayPurchaseOrderItem?.purchaseOrder?.id,
                })
              }
              type="button"
            >
              <AppIcon name="file" size={15} />
              View PO
            </button>
          ) : null}

          {canMoveToNeedsPo && (
            <button
              className={secondaryActionButtonClassName}
              disabled={isUpdating}
              onClick={() => onNeedToBuyInstead?.(part)}
              type="button"
            >
              <AppIcon name="box" size={15} />
              Need to Buy Instead
            </button>
          )}

          {returned && canManageReturns && (
            <button
              className={secondaryActionButtonClassName}
              disabled={isUpdating}
              onClick={() => onUndoReturn(part)}
              type="button"
            >
              <AppIcon name="refresh" size={15} />
              Undo
            </button>
          )}

          <button
            className={secondaryActionButtonClassName}
            onClick={() => onViewPrices(part)}
            type="button"
          >
            <AppIcon name="money" size={15} />
            Prices
          </button>

          <button
            className={secondaryActionButtonClassName}
            disabled={!part.vehicle_id}
            onClick={() => onOpenVehicle?.(part.vehicle_id)}
            type="button"
          >
            <AppIcon name="vehicle" size={15} />
            Open
          </button>

          {canApprovePart && (
            <>
              <button
                className={approveActionButtonClassName}
                disabled={isUpdating}
                onClick={() => onApprove(part)}
                type="button"
              >
                {isUpdating ? "Saving..." : "Approve"}
              </button>
              <button
                className={rejectActionButtonClassName}
                disabled={isUpdating}
                onClick={() => onReject(part)}
                type="button"
              >
                Reject
              </button>
            </>
          )}
        </aside>
      </div>

      {attributionText && (
        <footer className="mt-2 flex min-w-0 items-center gap-1.5 border-t border-slate-100 pt-2 text-[11px] font-semibold leading-4 text-slate-400">
          <AppIcon className="shrink-0" name="clock" size={13} />
          <span className="min-w-0 truncate">{attributionText}</span>
        </footer>
      )}
    </article>
  );
}

export default PartsQueueCard;
