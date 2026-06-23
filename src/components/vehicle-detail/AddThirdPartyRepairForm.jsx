import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { formControlClassNames } from "../ui/uiStyles";
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
        console.error("Could not save third-party repair:", error);
        setErrorMessage("Could not save third-party repair. Please try again.");
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
      console.error("Could not save third-party repair:", error);
      setErrorMessage("Could not save third-party repair. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="Record outside vendor work for this work order."
      eyebrow={getWorkOrderTitle(workOrder)}
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      size="lg"
      title="Add Third-Party Repair"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <fieldset className="space-y-4">
            <legend className="text-sm font-black text-slate-950">
              Vendor / Status
            </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="third-party-vendor">
              <span className={formControlClassNames.label}>Vendor</span>
              <select
                className={formControlClassNames.select}
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
              <span className={formControlClassNames.label}>Status</span>
              <select
                className={formControlClassNames.select}
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
          </fieldset>

          <label className="block" htmlFor="third-party-service">
            <span className={formControlClassNames.label}>
              Service Rendered
            </span>
            <input
              className={formControlClassNames.input}
              id="third-party-service"
              name="service_rendered"
              onChange={handleChange}
              required
              type="text"
              value={formData.service_rendered}
            />
          </label>

          <fieldset className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
            <legend className="px-1 text-sm font-black text-slate-950">
              Dates / Costs
            </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="third-party-outbound-date">
              <span className={formControlClassNames.label}>
                Outbound Date
              </span>
              <input
                className={formControlClassNames.input}
                id="third-party-outbound-date"
                name="outbound_date"
                onChange={handleChange}
                type="date"
                value={formData.outbound_date}
              />
            </label>

            <label className="block" htmlFor="third-party-inbound-date">
              <span className={formControlClassNames.label}>
                Inbound Date
              </span>
              <input
                className={formControlClassNames.input}
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
              <span className={formControlClassNames.label}>
                Repair Cost
              </span>
              <input
                className={formControlClassNames.input}
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
              <span className={formControlClassNames.label}>
                Transit Cost
              </span>
              <input
                className={formControlClassNames.input}
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
          </fieldset>

          <label className="block" htmlFor="third-party-notes">
            <span className={formControlClassNames.label}>Notes</span>
            <textarea
              className={formControlClassNames.textarea}
              id="third-party-notes"
              name="notes"
              onChange={handleChange}
              value={formData.notes}
            />
          </label>

          <FormMessage tone="error">{errorMessage}</FormMessage>

          <FormMessage tone="success">{successMessage}</FormMessage>

          <FormActions
            isSubmitting={isSubmitting}
            onCancel={onClose}
            submitLabel="Add Third-Party Repair"
            submittingLabel="Saving..."
          />
        </form>
    </ModalShell>
  );
}

export default AddThirdPartyRepairForm;
