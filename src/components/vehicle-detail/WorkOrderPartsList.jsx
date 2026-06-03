import { useState } from "react";
import { hasPermission } from "../../lib/permissions";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";
import CreatePurchaseOrderForm from "./CreatePurchaseOrderForm";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US");

const partSourceLabels = {
  in_house: "In-house / Available",
  needs_to_buy: "Needs to Buy",
};

const approvalLabels = {
  not_required: "Not Required",
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};

const statusLabels = {
  cancelled: "Cancelled",
  requested: "Requested",
  ordered: "Ordered",
  received: "Received",
  installed: "Installed",
};

const purchaseOrderBlockedStatuses = [
  "ordered",
  "received",
  "installed",
  "cancelled",
];

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

function formatLabel(value, labels) {
  if (labels[value]) {
    return labels[value];
  }

  return displayValue(value)
    .toString()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
  if (status === "cancelled") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "installed" || status === "received") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "ordered") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function sourceClassName(partSource) {
  if (partSource === "needs_to_buy") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
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
    part.part_source === "needs_to_buy" &&
    !purchaseOrderBlockedStatuses.includes(part.status)
  );
}

function WorkOrderPartsList({
  currentProfile,
  onActivityLogged,
  onPartApprovalUpdated,
  onPartPurchaseOrderCreated,
  parts = [],
  vehicleId,
  vendors = [],
}) {
  const [selectedPartForPurchaseOrder, setSelectedPartForPurchaseOrder] =
    useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [updatingPartId, setUpdatingPartId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleApprovalChange(part, approvalStatus) {
    if (!canApprovePart(currentProfile, part)) {
      setErrorMessage("Your role cannot approve or reject parts.");
      return;
    }

    setUpdatingPartId(part.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await supabase
        .from("part_requests")
        .update({ approval_status: approvalStatus })
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

    if (result?.partRequestStatusUpdated === false) {
      setSelectedPartForPurchaseOrder(null);
      setErrorMessage(
        result.warningMessage ??
          "Purchase order created, but the part status could not be updated."
      );
      return;
    }

    if (partRequestId && selectedPartForPurchaseOrder) {
      onPartPurchaseOrderCreated?.({
        ...selectedPartForPurchaseOrder,
        status: "ordered",
      });
    }

    setErrorMessage("");
    setSelectedPartForPurchaseOrder(null);
    setSuccessMessage("Purchase order created. Part status is now Ordered.");
  }

  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-sm font-bold text-zinc-950">Required Parts</h5>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200">
          {parts.length} {parts.length === 1 ? "part" : "parts"}
        </span>
      </div>

      {parts.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
          No parts added yet.
        </div>
      ) : (
        <div className="space-y-3">
          {parts.map((part, index) => (
            <article
              className="rounded-md border border-zinc-200 bg-white p-4"
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
                  <Badge className={sourceClassName(part.part_source)}>
                    {formatLabel(part.part_source, partSourceLabels)}
                  </Badge>
                  <Badge className={approvalClassName(part.approval_status)}>
                    {formatLabel(part.approval_status, approvalLabels)}
                  </Badge>
                  <Badge className={statusClassName(part.status)}>
                    {formatLabel(part.status, statusLabels)}
                  </Badge>
                </div>
              </div>

              {part.notes && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                  {part.notes}
                </p>
              )}

              {canCreatePurchaseOrder(currentProfile, part) &&
                part.approval_status === "pending" && (
                  <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Pending admin review, but PO can still be created.
                  </p>
                )}

              {(canApprovePart(currentProfile, part) ||
                canCreatePurchaseOrder(currentProfile, part)) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {canApprovePart(currentProfile, part) && (
                    <>
                      <button
                        className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
                        disabled={updatingPartId === part.id}
                        onClick={() => handleApprovalChange(part, "approved")}
                        type="button"
                      >
                        {updatingPartId === part.id ? "Saving..." : "Approve"}
                      </button>
                      <button
                        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={updatingPartId === part.id}
                        onClick={() => handleApprovalChange(part, "rejected")}
                        type="button"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {canCreatePurchaseOrder(currentProfile, part) && (
                    <button
                      className="rounded-md bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
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
                </div>
              )}
            </article>
          ))}
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
    </div>
  );
}

export default WorkOrderPartsList;
