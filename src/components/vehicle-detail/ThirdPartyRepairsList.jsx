import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";
import {
  getThirdPartyRepairStatusBadge,
  isThirdPartyRepairActive,
  THIRD_PARTY_REPAIR_COMPLETE_STATUS,
} from "../../lib/thirdPartyRepairWorkflow";
import DocumentsList from "./DocumentsList";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatCurrency(value) {
  const numberValue = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(numberValue) ? numberValue : 0);
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

function getFirstValue(record, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = record[fieldName];

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

function getVendorName(vendor) {
  return (
    getFirstValue(vendor, ["name", "vendor_name", "company_name"]) ??
    "No vendor assigned"
  );
}

function getVendorById(vendors, vendorId) {
  return vendors.find((vendor) => vendor.id === vendorId);
}

function getTotalCost(thirdPartyRepair) {
  const repairCost = Number(thirdPartyRepair.repair_cost || 0);
  const transitCost = Number(thirdPartyRepair.transit_cost || 0);

  return (
    (Number.isFinite(repairCost) ? repairCost : 0) +
    (Number.isFinite(transitCost) ? transitCost : 0)
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-zinc-950">
        {value}
      </dd>
    </div>
  );
}

function ThirdPartyRepairsList({
  canManage = false,
  canManageDocuments = false,
  canUploadDocuments = false,
  currentProfile,
  documents = [],
  hideHeader = false,
  onActivityLogged,
  onDocumentAdded,
  onDocumentDeleted,
  onThirdPartyRepairCompleted,
  onThirdPartyRepairDeleted,
  thirdPartyRepairs = [],
  vehicleId,
  vendors = [],
}) {
  const [deletingRepairId, setDeletingRepairId] = useState(null);
  const [completingRepairId, setCompletingRepairId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleDelete(thirdPartyRepair) {
    if (!canManage) {
      setErrorMessage("Your role cannot delete third-party repairs.");
      return;
    }

    const confirmed = window.confirm(
      "Delete this third-party repair? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setDeletingRepairId(thirdPartyRepair.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("third_party_repairs")
        .delete()
        .eq("id", thirdPartyRepair.id);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      await logVehicleActivity({
        vehicleId,
        action: "Third-party repair deleted",
        details: {
          service_rendered: thirdPartyRepair.service_rendered,
          repair_cost: thirdPartyRepair.repair_cost,
          transit_cost: thirdPartyRepair.transit_cost,
        },
      });
      onActivityLogged?.();
      await onThirdPartyRepairDeleted?.(thirdPartyRepair);
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setDeletingRepairId(null);
    }
  }

  async function handleMarkComplete(thirdPartyRepair) {
    if (!canManage) {
      setErrorMessage("Your role cannot update third-party repairs.");
      return;
    }

    setCompletingRepairId(thirdPartyRepair.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const completedDate = new Date().toISOString().slice(0, 10);
      const updateValues = {
        status: THIRD_PARTY_REPAIR_COMPLETE_STATUS,
      };

      if (!thirdPartyRepair.inbound_date) {
        updateValues.inbound_date = completedDate;
      }

      const { data, error } = await supabase
        .from("third_party_repairs")
        .update(updateValues)
        .eq("id", thirdPartyRepair.id)
        .select("*")
        .single();

      if (error) {
        console.error("Could not mark third-party repair complete:", error);
        setErrorMessage(
          "Could not mark third-party repair complete. Please try again."
        );
        return;
      }

      const updatedRepair = data ?? {
        ...thirdPartyRepair,
        ...updateValues,
      };

      await logVehicleActivity({
        vehicleId,
        action: "Third-party repair completed",
        details: {
          from: thirdPartyRepair.status,
          service_rendered: thirdPartyRepair.service_rendered,
          to: THIRD_PARTY_REPAIR_COMPLETE_STATUS,
        },
      });
      onActivityLogged?.();
      await onThirdPartyRepairCompleted?.(updatedRepair);
      setSuccessMessage("Third-party repair marked complete.");
    } catch (error) {
      console.error("Could not mark third-party repair complete:", error);
      setErrorMessage(
        "Could not mark third-party repair complete. Please try again."
      );
    } finally {
      setCompletingRepairId(null);
    }
  }

  return (
    <div className="rounded-md bg-zinc-50 p-3">
      {!hideHeader && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-sm font-bold text-zinc-950">
            Third-Party Repairs
          </h5>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200">
            {thirdPartyRepairs.length}{" "}
            {thirdPartyRepairs.length === 1 ? "repair" : "repairs"}
          </span>
        </div>
      )}

      {thirdPartyRepairs.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-200 bg-white p-3 text-sm text-zinc-500">
          No third-party repairs recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {thirdPartyRepairs.map((thirdPartyRepair, index) => {
            const vendor = getVendorById(vendors, thirdPartyRepair.vendor_id);
            const totalCost = getTotalCost(thirdPartyRepair);
            const badge = getThirdPartyRepairStatusBadge(
              thirdPartyRepair.status
            );
            const canMarkComplete =
              canManage && isThirdPartyRepairActive(thirdPartyRepair);
            const isCompleting =
              completingRepairId === thirdPartyRepair.id;

            return (
              <article
                className="rounded-md border border-zinc-100 bg-white p-3"
                key={thirdPartyRepair.id ?? index}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h6 className="font-semibold text-zinc-950">
                      {displayValue(thirdPartyRepair.service_rendered)}
                    </h6>
                    <p className="mt-1 text-sm text-zinc-500">
                      {vendor ? getVendorName(vendor) : "No vendor assigned"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badge.className}`}
                    >
                      {badge.label}
                    </span>

                    {canMarkComplete && (
                      <button
                        className="min-h-9 rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isCompleting}
                        onClick={() => handleMarkComplete(thirdPartyRepair)}
                        type="button"
                      >
                        {isCompleting ? "Completing..." : "Mark Complete"}
                      </button>
                    )}

                    {canManage && (
                      <button
                        className="min-h-9 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={
                          deletingRepairId === thirdPartyRepair.id ||
                          isCompleting
                        }
                        onClick={() => handleDelete(thirdPartyRepair)}
                        type="button"
                      >
                        {deletingRepairId === thirdPartyRepair.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    )}
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <DetailItem
                    label="Outbound"
                    value={formatDate(thirdPartyRepair.outbound_date)}
                  />
                  <DetailItem
                    label="Inbound"
                    value={formatDate(thirdPartyRepair.inbound_date)}
                  />
                  <DetailItem
                    label="Repair"
                    value={formatCurrency(thirdPartyRepair.repair_cost)}
                  />
                  <DetailItem
                    label="Transit"
                    value={formatCurrency(thirdPartyRepair.transit_cost)}
                  />
                  <DetailItem label="Total" value={formatCurrency(totalCost)} />
                </dl>

                {thirdPartyRepair.notes && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                    {thirdPartyRepair.notes}
                  </p>
                )}

                <DocumentsList
                  canDelete={canManageDocuments}
                  canUpload={canUploadDocuments}
                  currentProfile={currentProfile}
                  description="Upload a document or image invoice for this outside repair."
                  documentType="third_party_invoice"
                  documents={documents.filter(
                    (documentRecord) =>
                      documentRecord.third_party_repair_id ===
                      thirdPartyRepair.id
                  )}
                  emptyMessage="No invoices uploaded for this third-party repair."
                  onActivityLogged={onActivityLogged}
                  onDocumentAdded={onDocumentAdded}
                  onDocumentDeleted={onDocumentDeleted}
                  repairJobId={thirdPartyRepair.repair_job_id}
                  thirdPartyRepairId={thirdPartyRepair.id}
                  title="Invoices"
                  uploadButtonLabel="Upload Invoice"
                  uploadTitle="Upload Invoice"
                  vehicleId={vehicleId}
                />
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
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      )}
    </div>
  );
}

export default ThirdPartyRepairsList;
