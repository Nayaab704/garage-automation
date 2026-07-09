import { useMemo, useState } from "react";
import MarkReturnedModal from "../parts/MarkReturnedModal";
import { hasPermission } from "../../lib/permissions";
import { logVehicleActivity } from "../../lib/activityLogger";
import {
  formatPartLabel,
  getPrimaryPurchaseOrderItem,
  getRequiredPartBadges,
  isPartNeedsPo,
  partStatusLabels,
} from "../../lib/partWorkflowUtils";
import {
  getPrimaryReturnedPurchaseOrderItem,
  getReturnDeduction,
} from "../../lib/partReturns";
import { supabase } from "../../lib/supabaseClient";
import { formatUserFirstName } from "../../lib/userDisplay";
import CreatePurchaseOrderForm from "./CreatePurchaseOrderForm";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US");

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatCurrency(value) {
  const numberValue = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(numberValue) ? numberValue : 0);
}

function formatNumber(value) {
  const numberValue = Number(value ?? 0);

  if (!Number.isFinite(numberValue)) {
    return "Not available";
  }

  return numberFormatter.format(numberValue);
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

function getProfileById(profiles, profileId) {
  return profiles.find((profile) => profile.id === profileId) ?? null;
}

function getReturnedAttributionText(
  returnedPurchaseOrderItem,
  returnedByProfile,
  { includeDeduction = false } = {}
) {
  if (!returnedPurchaseOrderItem) {
    return "";
  }

  const returnedName = returnedByProfile
    ? formatUserFirstName(returnedByProfile)
    : returnedPurchaseOrderItem.returned_by
      ? "User"
      : "";
  const returnedLabel = returnedName ? `Returned by ${returnedName}` : "Returned";
  const returnedDate = returnedPurchaseOrderItem.returned_at
    ? formatDate(returnedPurchaseOrderItem.returned_at)
    : "";
  const deductionText = includeDeduction
    ? `${formatCurrency(getReturnDeduction(returnedPurchaseOrderItem))} deducted`
    : "";

  return [returnedLabel, returnedDate, deductionText].filter(Boolean).join(" - ");
}

function approvalClassName(approvalStatus) {
  if (approvalStatus === "approved" || approvalStatus === "not_required") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (approvalStatus === "rejected") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function statusClassName(status) {
  if (status === "cancelled" || status === "issues") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "returned") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "installed" || status === "received") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "ordered" || status === "po_created") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (status === "needs_po" || status === "needs_to_buy") {
    return "bg-amber-50 text-amber-800 ring-amber-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function sourceClassName(partSource) {
  if (partSource === "needs_to_buy") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function partBadgeClassName(badge) {
  if (badge.kind === "approval") {
    return approvalClassName(badge.value);
  }

  if (badge.kind === "source") {
    return sourceClassName(badge.value);
  }

  return statusClassName(badge.value);
}

function Badge({ children, className }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function getTotalCost(part) {
  const quantity = Number(part.quantity || 0);
  const unitCost = Number(part.unit_cost || 0);

  if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) {
    return 0;
  }

  return quantity * unitCost;
}

function canApprovePart(currentProfile, part) {
  const role = currentProfile?.role;

  return (
    (role === "admin" || role === "owner") &&
    part.part_source === "needs_to_buy" &&
    part.approval_status === "pending"
  );
}

function canCreatePurchaseOrder(currentProfile, part) {
  return (
    hasPermission(currentProfile?.role, "purchase_order:manage") &&
    isPartNeedsPo(part)
  );
}

function canManageReturns(currentProfile) {
  return ["admin", "owner", "technician"].includes(currentProfile?.role);
}

function canMarkReturned(item) {
  return ["ordered", "received"].includes(item?.status ?? "ordered");
}

function getPurchaseOrderLabel(purchaseOrder) {
  if (!purchaseOrder?.id) {
    return "PO";
  }

  return `PO ${String(purchaseOrder.id).slice(0, 8).toUpperCase()}`;
}

function getPurchaseOrderStatusLabel(purchaseOrder, item) {
  return formatPartLabel(
    purchaseOrder?.status ?? item?.status ?? "ordered",
    partStatusLabels
  );
}

function enrichPartsWithPurchaseOrders(parts, purchaseOrderItems, purchaseOrders) {
  const purchaseOrdersById = new Map(
    purchaseOrders
      .filter((purchaseOrder) => purchaseOrder?.id)
      .map((purchaseOrder) => [purchaseOrder.id, purchaseOrder])
  );

  return parts.map((part) => ({
    ...part,
    purchaseOrderItems: purchaseOrderItems
      .filter((item) => item.part_request_id === part.id)
      .map((item) => ({
        ...item,
        purchaseOrder: purchaseOrdersById.get(item.purchase_order_id) ?? null,
      })),
  }));
}

function WorkOrderPartsList({
  currentProfile,
  hideHeader = false,
  onActivityLogged,
  onOpenPurchaseOrders,
  onPartApprovalUpdated,
  onPartPurchaseOrderCreated,
  onPurchaseOrderItemUpdated,
  parts = [],
  profiles = [],
  purchaseOrderItems = [],
  purchaseOrders = [],
  vehicleId,
  vendors = [],
}) {
  const [selectedPartForPurchaseOrder, setSelectedPartForPurchaseOrder] =
    useState(null);
  const [returningPartContext, setReturningPartContext] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [updatingPartId, setUpdatingPartId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const enrichedParts = useMemo(
    () => enrichPartsWithPurchaseOrders(parts, purchaseOrderItems, purchaseOrders),
    [parts, purchaseOrderItems, purchaseOrders]
  );
  const canManagePartReturns = canManageReturns(currentProfile);

  async function handleApprovalChange(part, approvalStatus) {
    if (!canApprovePart(currentProfile, part)) {
      setErrorMessage("Your role cannot approve or reject parts.");
      return;
    }

    setUpdatingPartId(part.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const reviewValues =
        approvalStatus === "approved"
          ? {
              approval_status: approvalStatus,
              approved_at: new Date().toISOString(),
              approved_by: currentProfile?.id ?? null,
            }
          : {
              approval_status: approvalStatus,
              approved_at: null,
              approved_by: null,
            };
      const { data, error } = await supabase
        .from("part_requests")
        .update(reviewValues)
        .eq("id", part.id)
        .select("*")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      await logVehicleActivity({
        vehicleId,
        action:
          approvalStatus === "approved"
            ? "Part request approved"
            : "Part request rejected",
        details: {
          part_name: part.part_name,
          quantity: part.quantity,
        },
      });
      onActivityLogged?.();
      onPartApprovalUpdated?.(data ?? { ...part, approval_status: approvalStatus });
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setUpdatingPartId(null);
    }
  }

  function handlePurchaseOrderCreated(result) {
    const partRequestId =
      result?.partRequestId ?? selectedPartForPurchaseOrder?.id;

    if (partRequestId && selectedPartForPurchaseOrder) {
      onPartPurchaseOrderCreated?.({
        ...result,
        partRequest:
          result?.partRequest ??
          (result?.partRequestStatusUpdated === false
            ? selectedPartForPurchaseOrder
            : { ...selectedPartForPurchaseOrder, status: "ordered" }),
        partRequestId,
      });
    }

    setSelectedPartForPurchaseOrder(null);

    if (result?.partRequestStatusUpdated === false) {
      setErrorMessage(
        result.warningMessage ??
          "Purchase order created, but the part status could not be updated."
      );
      setSuccessMessage("");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("Purchase order created. Part now shows PO Created.");
  }

  async function handleReturnedItemUpdated(updatedItem) {
    await onPurchaseOrderItemUpdated?.(updatedItem);
    onActivityLogged?.();
    setSuccessMessage("Part marked returned.");
    setErrorMessage("");
  }

  return (
    <div className="rounded-md bg-zinc-50 p-3">
      {!hideHeader && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-sm font-bold text-zinc-950">Required Parts</h5>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200">
            {parts.length} {parts.length === 1 ? "part" : "parts"}
          </span>
        </div>
      )}

      {parts.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-200 bg-white p-3 text-sm text-zinc-500">
          No parts added yet.
        </div>
      ) : (
        <div className="space-y-3">
          {enrichedParts.map((part, index) => {
            const primaryPurchaseOrderItem = getPrimaryPurchaseOrderItem(part);
            const returnedPurchaseOrderItem =
              getPrimaryReturnedPurchaseOrderItem(part);
            const displayPurchaseOrderItem =
              primaryPurchaseOrderItem ?? returnedPurchaseOrderItem;
            const linkedPurchaseOrder = displayPurchaseOrderItem?.purchaseOrder;
            const partBadges = getRequiredPartBadges(part);
            const canCreatePoForPart = canCreatePurchaseOrder(currentProfile, part);
            const canApprove = canApprovePart(currentProfile, part);
            const createdByProfile = getProfileById(profiles, part.created_by);
            const approvedByProfile = getProfileById(profiles, part.approved_by);
            const returnedByProfile = getProfileById(
              profiles,
              returnedPurchaseOrderItem?.returned_by
            );
            const returnedAttributionText = getReturnedAttributionText(
              returnedPurchaseOrderItem,
              returnedByProfile
            );
            const addedAttributionText = [
              createdByProfile
                ? `Added by ${formatUserFirstName(createdByProfile)}`
                : "",
              part.created_at ? formatDate(part.created_at) : "",
              approvedByProfile && part.approved_at
                ? `Approved by ${formatUserFirstName(approvedByProfile)} ${formatDate(
                    part.approved_at
                  )}`
                : "",
            ]
              .filter(Boolean)
              .join(" - ");
            const partAttributionText = returnedPurchaseOrderItem
              ? getReturnedAttributionText(
                  returnedPurchaseOrderItem,
                  returnedByProfile,
                  { includeDeduction: true }
                )
              : addedAttributionText;

            return (
              <article
                className="rounded-md border border-zinc-100 bg-white p-3"
                key={part.id ?? index}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h6 className="font-semibold text-zinc-950">
                      {displayValue(part.part_name)}
                    </h6>
                    <p className="mt-1 text-sm text-zinc-500">
                      Qty {formatNumber(part.quantity)} x{" "}
                      {formatCurrency(part.unit_cost)} ={" "}
                      <span className="font-semibold text-zinc-700">
                        {formatCurrency(getTotalCost(part))}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {partBadges.map((badge) => (
                      <Badge
                        className={partBadgeClassName(badge)}
                        key={badge.key}
                      >
                        {badge.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {returnedPurchaseOrderItem ? (
                  <p className="mt-3 rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-800">
                    Returned -{" "}
                    {formatCurrency(getReturnDeduction(returnedPurchaseOrderItem))}{" "}
                    deducted
                    {returnedAttributionText ? ` - ${returnedAttributionText}` : ""}
                    .
                  </p>
                ) : primaryPurchaseOrderItem ? (
                  <p className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm font-medium text-blue-800">
                    PO already created
                    {linkedPurchaseOrder
                      ? `: ${getPurchaseOrderLabel(linkedPurchaseOrder)}`
                      : ""}
                    . Status:{" "}
                    {getPurchaseOrderStatusLabel(
                      linkedPurchaseOrder,
                      primaryPurchaseOrderItem
                    )}
                    .
                  </p>
                ) : null}

                {part.notes && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                    {part.notes}
                  </p>
                )}

                {partAttributionText && (
                  <p className="mt-3 text-xs font-semibold text-zinc-400">
                    {partAttributionText}
                  </p>
                )}

                {canCreatePoForPart && part.approval_status === "pending" && (
                  <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Pending admin review, but PO can still be created.
                  </p>
                )}

                {(canApprove ||
                  canCreatePoForPart ||
                  displayPurchaseOrderItem) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {canApprove && (
                      <>
                        <button
                          className="min-h-9 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
                          disabled={updatingPartId === part.id}
                          onClick={() => handleApprovalChange(part, "approved")}
                          type="button"
                        >
                          {updatingPartId === part.id ? "Saving..." : "Approve"}
                        </button>
                        <button
                          className="min-h-9 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={updatingPartId === part.id}
                          onClick={() => handleApprovalChange(part, "rejected")}
                          type="button"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {canCreatePoForPart && (
                      <button
                        className="min-h-9 rounded-md bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
                        onClick={() => {
                          setErrorMessage("");
                          setSuccessMessage("");
                          setSelectedPartForPurchaseOrder(part);
                        }}
                        type="button"
                      >
                        Create PO
                      </button>
                    )}

                    {displayPurchaseOrderItem && (
                      <button
                        className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                        onClick={onOpenPurchaseOrders}
                        type="button"
                      >
                        View PO
                      </button>
                    )}

                    {canManagePartReturns &&
                      primaryPurchaseOrderItem &&
                      canMarkReturned(primaryPurchaseOrderItem) && (
                        <button
                          className="min-h-9 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                          onClick={() =>
                            setReturningPartContext({
                              item: primaryPurchaseOrderItem,
                              purchaseOrder: linkedPurchaseOrder,
                            })
                          }
                          type="button"
                        >
                          Mark Returned
                        </button>
                      )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}

      {selectedPartForPurchaseOrder && (
        <CreatePurchaseOrderForm
          currentProfile={currentProfile}
          initialPartRequest={selectedPartForPurchaseOrder}
          lockPartRequest
          onActivityLogged={onActivityLogged}
          onClose={() => setSelectedPartForPurchaseOrder(null)}
          onPurchaseOrderCreated={handlePurchaseOrderCreated}
          partRequests={[selectedPartForPurchaseOrder]}
          vehicleId={vehicleId}
          vendors={vendors}
        />
      )}

      {returningPartContext && canManagePartReturns && (
        <MarkReturnedModal
          currentProfile={currentProfile}
          item={returningPartContext.item}
          key={returningPartContext.item.id}
          onClose={() => setReturningPartContext(null)}
          onReturned={handleReturnedItemUpdated}
          purchaseOrder={returningPartContext.purchaseOrder}
          vehicleId={vehicleId}
        />
      )}
    </div>
  );
}

export default WorkOrderPartsList;
