import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";

const emptyForm = {
  vendor_id: "",
  service_rendered: "",
  status: "planned",
  outbound_date: "",
  inbound_date: "",
  repair_cost: "",
  transit_cost: "",
  notes: "",
};

const statusOptions = [
  { value: "planned", label: "Planned" },
  { value: "sent_out", label: "Sent Out" },
  { value: "in_progress", label: "In Progress" },
  { value: "returned", label: "Returned" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const allowedStatuses = statusOptions.map((option) => option.value);

function emptyToNull(value) {
  const trimmedValue = String(value ?? "").trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function numberOrZero(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
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
    "Unnamed Vendor"
  );
}

function getValidStatus(status) {
  return allowedStatuses.includes(status) ? status : "planned";
}

function getWorkOrderTitle(workOrder) {
  return workOrder?.title || workOrder?.name || "Work Order";
}

function AddThirdPartyRepairForm({
  currentProfile,
  onActivityLogged,
  onClose,
  onThirdPartyRepairAdded,
  vehicleId,
  vendors = [],
  workOrder,
}) {
  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const serviceRendered = emptyToNull(formData.service_rendered);

    if (!serviceRendered) {
      setErrorMessage("Service rendered is required.");
      return;
    }

    if (!vehicleId || !workOrder?.id) {
      setErrorMessage("Unable to add third-party repair without a work order.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const thirdPartyRepair = {
        vehicle_id: vehicleId,
        repair_job_id: workOrder.id,
        vendor_id: formData.vendor_id || null,
        service_rendered: serviceRendered,
        status: getValidStatus(formData.status),
        outbound_date: emptyToNull(formData.outbound_date),
        inbound_date: emptyToNull(formData.inbound_date),
        repair_cost: numberOrZero(formData.repair_cost),
        transit_cost: numberOrZero(formData.transit_cost),
        notes: emptyToNull(formData.notes),
        created_by: currentProfile?.id ?? null,
      };

      const { data, error } = await supabase
        .from("third_party_repairs")
        .insert([thirdPartyRepair])
        .select("*")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setFormData(emptyForm);
      setSuccessMessage("Third-party repair added successfully.");
      await logVehicleActivity({
        vehicleId,
        action: "Third-party repair added",
        details: {
          service_rendered: thirdPartyRepair.service_rendered,
          vendor: thirdPartyRepair.vendor_id
            ? getVendorName(
                vendors.find(
                  (vendor) => vendor.id === thirdPartyRepair.vendor_id
                ) ?? {}
              )
            : null,
          work_order: getWorkOrderTitle(workOrder),
          repair_cost: thirdPartyRepair.repair_cost,
          transit_cost: thirdPartyRepair.transit_cost,
        },
      });
      onActivityLogged?.();
      await onThirdPartyRepairAdded?.(data ?? thirdPartyRepair);
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {getWorkOrderTitle(workOrder)}
            </p>
            <h3 className="mt-1 text-lg font-bold text-zinc-950">
              Add Third-Party Repair
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Record outside vendor work for this work order.
            </p>
          </div>

          <button
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="third-party-vendor">
              <span className="text-sm font-medium text-zinc-700">Vendor</span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="third-party-vendor"
                name="vendor_id"
                onChange={handleChange}
                value={formData.vendor_id}
              >
                <option value="">No vendor assigned</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {getVendorName(vendor)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block" htmlFor="third-party-status">
              <span className="text-sm font-medium text-zinc-700">Status</span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="third-party-status"
                name="status"
                onChange={handleChange}
                value={formData.status}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block" htmlFor="third-party-service">
            <span className="text-sm font-medium text-zinc-700">
              Service Rendered
            </span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="third-party-service"
              name="service_rendered"
              onChange={handleChange}
              required
              type="text"
              value={formData.service_rendered}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="third-party-outbound-date">
              <span className="text-sm font-medium text-zinc-700">
                Outbound Date
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="third-party-outbound-date"
                name="outbound_date"
                onChange={handleChange}
                type="date"
                value={formData.outbound_date}
              />
            </label>

            <label className="block" htmlFor="third-party-inbound-date">
              <span className="text-sm font-medium text-zinc-700">
                Inbound Date
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="third-party-inbound-date"
                name="inbound_date"
                onChange={handleChange}
                type="date"
                value={formData.inbound_date}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="third-party-repair-cost">
              <span className="text-sm font-medium text-zinc-700">
                Repair Cost
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="third-party-repair-cost"
                min="0"
                name="repair_cost"
                onChange={handleChange}
                step="0.01"
                type="number"
                value={formData.repair_cost}
              />
            </label>

            <label className="block" htmlFor="third-party-transit-cost">
              <span className="text-sm font-medium text-zinc-700">
                Transit Cost
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="third-party-transit-cost"
                min="0"
                name="transit_cost"
                onChange={handleChange}
                step="0.01"
                type="number"
                value={formData.transit_cost}
              />
            </label>
          </div>

          <label className="block" htmlFor="third-party-notes">
            <span className="text-sm font-medium text-zinc-700">Notes</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="third-party-notes"
              name="notes"
              onChange={handleChange}
              value={formData.notes}
            />
          </label>

          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {successMessage}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>

            <button
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Adding..." : "Add Third-Party Repair"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddThirdPartyRepairForm;
