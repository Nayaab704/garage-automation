import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

const statusLabels = {
  planned: "Planned",
  sent_out: "Sent Out",
  in_progress: "In Progress",
  returned: "Returned",
  completed: "Completed",
  cancelled: "Cancelled",
};

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

function statusClassName(status) {
  if (status === "completed" || status === "returned") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "sent_out" || status === "in_progress") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
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
      <dd className="mt-1 text-sm font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}

function ThirdPartyRepairsList({
  canManage = false,
  onActivityLogged,
  onThirdPartyRepairDeleted,
  thirdPartyRepairs = [],
  vehicleId,
  vendors = [],
}) {
  const [deletingRepairId, setDeletingRepairId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

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

  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-sm font-bold text-zinc-950">
          Third-Party Repairs
        </h5>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200">
          {thirdPartyRepairs.length}{" "}
          {thirdPartyRepairs.length === 1 ? "repair" : "repairs"}
        </span>
      </div>

      {thirdPartyRepairs.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
          No third-party repairs recorded for this work order.
        </div>
      ) : (
        <div className="space-y-3">
          {thirdPartyRepairs.map((thirdPartyRepair, index) => {
            const vendor = getVendorById(vendors, thirdPartyRepair.vendor_id);
            const totalCost = getTotalCost(thirdPartyRepair);

            return (
              <article
                className="rounded-md border border-zinc-200 bg-white p-4"
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
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClassName(
                        thirdPartyRepair.status
                      )}`}
                    >
                      {formatLabel(thirdPartyRepair.status, statusLabels)}
                    </span>

                    {canManage && (
                      <button
                        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={deletingRepairId === thirdPartyRepair.id}
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
    </div>
  );
}

export default ThirdPartyRepairsList;
