import { useState } from "react";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";

const emptyForm = {
  vendor_id: "",
  part_request_id: "",
  description: "",
  quantity: "1",
  unit_cost: "",
  shipping_cost: "",
  tax: "",
  notes: "",
};

const purchaseOrderBlockedStatuses = [
  "ordered",
  "received",
  "installed",
  "cancelled",
];

function emptyToNull(value) {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
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

function getPartRequestName(partRequest) {
  return (
    getFirstValue(partRequest, ["part_name", "name", "part"]) ??
    "Unnamed Part"
  );
}

function valueToString(value) {
  return value === null || value === undefined ? "" : String(value);
}

function canCreatePurchaseOrderForPart(partRequest) {
  return (
    partRequest?.part_source === "needs_to_buy" &&
    !purchaseOrderBlockedStatuses.includes(partRequest?.status)
  );
}

function getInitialFormData(initialPartRequest) {
  if (!initialPartRequest?.id) {
    return emptyForm;
  }

  return {
    ...emptyForm,
    description: getPartRequestName(initialPartRequest),
    part_request_id: initialPartRequest.id,
    quantity: valueToString(initialPartRequest.quantity || 1),
    unit_cost: valueToString(initialPartRequest.unit_cost ?? ""),
  };
}

function parseNumberWithDefault(value, defaultValue, label) {
  const numberValue = Number(value || defaultValue);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return { error: `${label} must be 0 or greater.`, value: null };
  }

  return { error: "", value: numberValue };
}

function CreatePurchaseOrderForm({
  currentProfile,
  initialPartRequest = null,
  lockPartRequest = false,
  onClose,
  onActivityLogged,
  onPurchaseOrderCreated,
  partRequests = [],
  vehicleId,
  vendors = [],
}) {
  const [formData, setFormData] = useState(() =>
    getInitialFormData(initialPartRequest)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const availablePartRequests = partRequests.filter(canCreatePurchaseOrderForPart);
  const selectedPartRequest =
    partRequests.find(
      (partRequest) => partRequest.id === formData.part_request_id
    ) ?? initialPartRequest;

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function handlePartRequestChange(event) {
    const selectedPartRequestId = event.target.value;
    const selectedPartRequest = partRequests.find(
      (partRequest) => partRequest.id === selectedPartRequestId
    );

    setFormData((currentFormData) => ({
      ...currentFormData,
      part_request_id: selectedPartRequestId,
      description:
        currentFormData.description ||
        (selectedPartRequest ? getPartRequestName(selectedPartRequest) : ""),
      quantity:
        currentFormData.quantity ||
        valueToString(selectedPartRequest?.quantity || 1),
      unit_cost:
        currentFormData.unit_cost ||
        valueToString(selectedPartRequest?.unit_cost ?? ""),
    }));
  }

  function validateForm() {
    const description = emptyToNull(formData.description);
    const quantity = Number(formData.quantity || 1);
    const unitCost = parseNumberWithDefault(formData.unit_cost, 0, "Unit cost");
    const shippingCost = parseNumberWithDefault(
      formData.shipping_cost,
      0,
      "Shipping cost"
    );
    const tax = parseNumberWithDefault(formData.tax, 0, "Tax");

    if (!formData.vendor_id) {
      return { error: "Vendor is required." };
    }

    if (!formData.part_request_id) {
      return { error: "Part request is required." };
    }

    const selectedPartRequest = partRequests.find(
      (partRequest) => partRequest.id === formData.part_request_id
    );

    if (!canCreatePurchaseOrderForPart(selectedPartRequest)) {
      return {
        error:
          "Purchase orders can only be created for needs-to-buy parts that have not already been ordered or completed.",
      };
    }

    if (!description) {
      return { error: "Description is required." };
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return { error: "Quantity must be a whole number of at least 1." };
    }

    if (unitCost.error) {
      return { error: unitCost.error };
    }

    if (shippingCost.error) {
      return { error: shippingCost.error };
    }

    if (tax.error) {
      return { error: tax.error };
    }

    return {
      error: "",
      values: {
        description,
        quantity,
        shippingCost: shippingCost.value,
        tax: tax.value,
        unitCost: unitCost.value,
      },
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    setWarningMessage("");

    try {
      const validation = validateForm();

      if (validation.error) {
        setErrorMessage(validation.error);
        return;
      }

      const purchaseOrder = {
        ordered_by: currentProfile?.id ?? null,
        vehicle_id: vehicleId,
        vendor_id: formData.vendor_id,
        status: "ordered",
        ordered_at: new Date().toISOString(),
      };

      const purchaseOrderResponse = await supabase
        .from("purchase_orders")
        .insert([purchaseOrder])
        .select("id")
        .single();

      if (purchaseOrderResponse.error) {
        setErrorMessage(purchaseOrderResponse.error.message);
        return;
      }

      const purchaseOrderId = purchaseOrderResponse.data.id;
      const purchaseOrderItem = {
        purchase_order_id: purchaseOrderId,
        part_request_id: formData.part_request_id,
        description: validation.values.description,
        quantity: validation.values.quantity,
        unit_cost: validation.values.unitCost,
        shipping_cost: validation.values.shippingCost,
        status: "ordered",
        tax: validation.values.tax,
        notes: emptyToNull(formData.notes),
      };

      const itemResponse = await supabase
        .from("purchase_order_items")
        .insert([purchaseOrderItem]);

      if (itemResponse.error) {
        const cleanupResponse = await supabase
          .from("purchase_orders")
          .delete()
          .eq("id", purchaseOrderId);

        if (cleanupResponse.error) {
          setErrorMessage(
            `${itemResponse.error.message} The empty purchase order could not be removed: ${cleanupResponse.error.message}`
          );
        } else {
          setErrorMessage(
            `${itemResponse.error.message} The empty purchase order was removed.`
          );
        }

        return;
      }

      const partRequestResponse = await supabase
        .from("part_requests")
        .update({ status: "ordered" })
        .eq("id", formData.part_request_id);

      let statusWarning = "";
      const selectedPartRequest = partRequests.find(
        (partRequest) => partRequest.id === formData.part_request_id
      );

      if (partRequestResponse.error) {
        statusWarning = `Purchase order created, but the part request status could not be updated: ${partRequestResponse.error.message}`;
      }
      const partRequestStatusUpdated = !partRequestResponse.error;

      setFormData(getInitialFormData(initialPartRequest));
      setSuccessMessage("Purchase order created successfully.");
      setWarningMessage(statusWarning);
      await logVehicleActivity({
        vehicleId,
        action: "Purchase order created",
        details: {
          description: validation.values.description,
          quantity: validation.values.quantity,
          unit_cost: validation.values.unitCost,
          vendor: getVendorName(
            vendors.find((vendor) => vendor.id === formData.vendor_id) ?? {}
          ),
          part_name: getPartRequestName(
            partRequests.find(
              (partRequest) => partRequest.id === formData.part_request_id
            ) ?? {}
          ),
        },
      });
      if (!partRequestResponse.error) {
        await logVehicleActivity({
          vehicleId,
          action: "Part request status changed",
          details: {
            part_name: getPartRequestName(selectedPartRequest ?? {}),
            from: selectedPartRequest?.status,
            to: "ordered",
          },
        });
      }
      onActivityLogged?.();

      await onPurchaseOrderCreated?.({
        partRequestId: formData.part_request_id,
        partRequestStatusUpdated,
        purchaseOrderId,
        status: "ordered",
        warningMessage: statusWarning,
      });
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
            <h3 className="text-lg font-bold text-zinc-950">
              Create Purchase Order
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Order a requested part from a vendor.
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
            <label className="block" htmlFor="purchase-order-vendor">
              <span className="text-sm font-medium text-zinc-700">
                Vendor
              </span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="purchase-order-vendor"
                name="vendor_id"
                onChange={handleChange}
                required
                value={formData.vendor_id}
              >
                <option value="">Select a vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {getVendorName(vendor)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block" htmlFor="purchase-order-part-request">
              <span className="text-sm font-medium text-zinc-700">
                Part Request
              </span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                disabled={lockPartRequest}
                id="purchase-order-part-request"
                name="part_request_id"
                onChange={handlePartRequestChange}
                required
                value={formData.part_request_id}
              >
                <option value="">Select a part request</option>
                {availablePartRequests.map((partRequest) => (
                  <option key={partRequest.id} value={partRequest.id}>
                    {getPartRequestName(partRequest)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedPartRequest?.approval_status === "pending" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Pending admin review, but PO can still be created.
            </div>
          )}

          <label className="block" htmlFor="purchase-order-description">
            <span className="text-sm font-medium text-zinc-700">
              Description
            </span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="purchase-order-description"
              name="description"
              onChange={handleChange}
              required
              type="text"
              value={formData.description}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-4">
            <label className="block" htmlFor="purchase-order-quantity">
              <span className="text-sm font-medium text-zinc-700">
                Quantity
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="purchase-order-quantity"
                min="1"
                name="quantity"
                onChange={handleChange}
                step="1"
                type="number"
                value={formData.quantity}
              />
            </label>

            <label className="block" htmlFor="purchase-order-unit-cost">
              <span className="text-sm font-medium text-zinc-700">
                Unit Cost
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="purchase-order-unit-cost"
                min="0"
                name="unit_cost"
                onChange={handleChange}
                step="0.01"
                type="number"
                value={formData.unit_cost}
              />
            </label>

            <label className="block" htmlFor="purchase-order-shipping">
              <span className="text-sm font-medium text-zinc-700">
                Shipping
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="purchase-order-shipping"
                min="0"
                name="shipping_cost"
                onChange={handleChange}
                step="0.01"
                type="number"
                value={formData.shipping_cost}
              />
            </label>

            <label className="block" htmlFor="purchase-order-tax">
              <span className="text-sm font-medium text-zinc-700">Tax</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="purchase-order-tax"
                min="0"
                name="tax"
                onChange={handleChange}
                step="0.01"
                type="number"
                value={formData.tax}
              />
            </label>
          </div>

          <label className="block" htmlFor="purchase-order-notes">
            <span className="text-sm font-medium text-zinc-700">Notes</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="purchase-order-notes"
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

          {warningMessage && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {warningMessage}
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
              {isSubmitting ? "Creating..." : "Create Purchase Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreatePurchaseOrderForm;
