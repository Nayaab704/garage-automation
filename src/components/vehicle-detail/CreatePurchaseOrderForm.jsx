import { useMemo, useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { formControlClassNames } from "../ui/uiStyles";
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

function getPartRequestVendorId(partRequest) {
  return valueToString(
    partRequest?.selected_vendor_id ??
      partRequest?.selectedVendor?.id ??
      partRequest?.selectedQuote?.vendor_id ??
      ""
  );
}

function getPartRequestVendorName(partRequest) {
  return (
    getFirstValue(partRequest?.selectedVendor ?? {}, [
      "name",
      "vendor_name",
      "company_name",
    ]) ??
    getFirstValue(partRequest?.selectedQuote ?? {}, [
      "vendor_name_snapshot",
      "vendor_name",
      "display_vendor_name",
    ]) ??
    "Selected vendor"
  );
}

function mergeVendorOptions(vendors, selectedVendorOption) {
  const vendorOptionsById = new Map();

  for (const vendor of vendors) {
    if (vendor?.id) {
      vendorOptionsById.set(vendor.id, vendor);
    }
  }

  if (selectedVendorOption?.id && !vendorOptionsById.has(selectedVendorOption.id)) {
    vendorOptionsById.set(selectedVendorOption.id, selectedVendorOption);
  }

  return [...vendorOptionsById.values()];
}

function canCreatePurchaseOrderForPart(partRequest) {
  return (
    partRequest?.part_source === "needs_to_buy" &&
    !purchaseOrderBlockedStatuses.includes(partRequest?.status)
  );
}

function getInitialFormData(initialPartRequest, initialVendorId = "") {
  const unitCost =
    initialPartRequest?.quoted_unit_cost ??
    initialPartRequest?.selectedQuote?.unit_price ??
    initialPartRequest?.unit_cost ??
    "";
  const vendorId = valueToString(
    initialVendorId || getPartRequestVendorId(initialPartRequest)
  );

  if (!initialPartRequest?.id) {
    return {
      ...emptyForm,
      vendor_id: vendorId,
    };
  }

  return {
    ...emptyForm,
    description: getPartRequestName(initialPartRequest),
    part_request_id: initialPartRequest.id,
    quantity: valueToString(initialPartRequest.quantity || 1),
    unit_cost: valueToString(unitCost),
    vendor_id: vendorId,
  };
}

function parseNumberWithDefault(value, defaultValue, label) {
  const numberValue = Number(value || defaultValue);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return { error: `${label} must be 0 or greater.`, value: null };
  }

  return { error: "", value: numberValue };
}

async function hasActivePurchaseOrderItem(partRequestId) {
  if (!partRequestId) {
    return { exists: false, error: null };
  }

  const { data, error } = await supabase
    .from("purchase_order_items")
    .select("id, status")
    .eq("part_request_id", partRequestId);

  if (error) {
    return { exists: false, error };
  }

  return {
    error: null,
    exists: (data ?? []).some(
      (item) => !["cancelled", "returned"].includes(item.status)
    ),
  };
}

function CreatePurchaseOrderForm({
  currentProfile,
  initialPartRequest = null,
  initialVendorId = "",
  lockPartRequest = false,
  onClose,
  onActivityLogged,
  onPurchaseOrderCreated,
  partRequests = [],
  vehicleId,
  vendors = [],
}) {
  const initialFormData = useMemo(
    () => getInitialFormData(initialPartRequest, initialVendorId),
    [initialPartRequest, initialVendorId]
  );
  const [formData, setFormData] = useState(() =>
    initialFormData
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
  const selectedVendorOption = useMemo(() => {
    const vendorSourcePart = selectedPartRequest ?? initialPartRequest;
    const selectedVendorId =
      formData.vendor_id ||
      initialVendorId ||
      getPartRequestVendorId(vendorSourcePart);

    return selectedVendorId
      ? {
          id: selectedVendorId,
          name: getPartRequestVendorName(vendorSourcePart),
        }
      : null;
  }, [formData.vendor_id, initialPartRequest, initialVendorId, selectedPartRequest]);
  const vendorOptions = useMemo(
    () => mergeVendorOptions(vendors, selectedVendorOption),
    [selectedVendorOption, vendors]
  );
  const selectedPriceSourcePart = selectedPartRequest ?? initialPartRequest;
  const hasSelectedVendorPrice = Boolean(
    selectedPriceSourcePart?.selected_vendor_id &&
      (selectedPriceSourcePart?.selected_quote_id ||
        selectedPriceSourcePart?.selectedQuote?.id)
  );
  const selectedPriceVendorName = getPartRequestVendorName(selectedPriceSourcePart);

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
        valueToString(
          selectedPartRequest?.quoted_unit_cost ??
            selectedPartRequest?.selectedQuote?.unit_price ??
            selectedPartRequest?.unit_cost ??
            ""
        ),
      vendor_id:
        currentFormData.vendor_id || getPartRequestVendorId(selectedPartRequest),
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

      const duplicateCheck = await hasActivePurchaseOrderItem(
        formData.part_request_id
      );

      if (duplicateCheck.error) {
        setErrorMessage(duplicateCheck.error.message);
        return;
      }

      if (duplicateCheck.exists) {
        setErrorMessage("A purchase order already exists for this part.");
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
        .insert([purchaseOrderItem])
        .select("id")
        .single();

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

      setFormData(initialFormData);
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
            vendorOptions.find((vendor) => vendor.id === formData.vendor_id) ?? {}
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
        purchaseOrderItemId: itemResponse.data?.id ?? null,
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
    <ModalShell
      description="Order a requested part from a vendor."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      size="lg"
      title="Create Purchase Order"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <fieldset className="space-y-4">
            <legend className="text-sm font-black text-slate-950">
              Vendor / Part
            </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="purchase-order-vendor">
              <span className={formControlClassNames.label}>Vendor</span>
              <select
                className={formControlClassNames.select}
                id="purchase-order-vendor"
                name="vendor_id"
                onChange={handleChange}
                required
                value={formData.vendor_id}
              >
                <option value="">Select a vendor</option>
                {vendorOptions.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {getVendorName(vendor)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block" htmlFor="purchase-order-part-request">
              <span className={formControlClassNames.label}>Part Request</span>
              <select
                className={formControlClassNames.select}
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

          {hasSelectedVendorPrice ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
              Using selected price from {selectedPriceVendorName}.
            </div>
          ) : !formData.vendor_id ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
              No vendor selected yet. Choose a vendor or use View Prices first.
            </div>
          ) : null}
          </fieldset>

          {selectedPartRequest?.approval_status === "pending" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Pending admin review. PO creation is still allowed.
            </div>
          )}

          <label className="block" htmlFor="purchase-order-description">
            <span className={formControlClassNames.label}>Description</span>
            <input
              className={formControlClassNames.input}
              id="purchase-order-description"
              name="description"
              onChange={handleChange}
              required
              type="text"
              value={formData.description}
            />
          </label>

          <fieldset className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
            <legend className="px-1 text-sm font-black text-slate-950">
              Cost Details
            </legend>
          <div className="grid gap-4 sm:grid-cols-4">
            <label className="block" htmlFor="purchase-order-quantity">
              <span className={formControlClassNames.label}>Quantity</span>
              <input
                className={formControlClassNames.input}
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
              <span className={formControlClassNames.label}>Unit Cost</span>
              <input
                className={formControlClassNames.input}
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
              <span className={formControlClassNames.label}>Shipping</span>
              <input
                className={formControlClassNames.input}
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
              <span className={formControlClassNames.label}>Tax</span>
              <input
                className={formControlClassNames.input}
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
          </fieldset>

          <label className="block" htmlFor="purchase-order-notes">
            <span className={formControlClassNames.label}>Notes</span>
            <textarea
              className={formControlClassNames.textarea}
              id="purchase-order-notes"
              name="notes"
              onChange={handleChange}
              value={formData.notes}
            />
          </label>

          <FormMessage tone="error">{errorMessage}</FormMessage>

          <FormMessage tone="success">{successMessage}</FormMessage>

          <FormMessage tone="warning">{warningMessage}</FormMessage>

          <FormActions
            isSubmitting={isSubmitting}
            onCancel={onClose}
            submitLabel="Create Purchase Order"
            submittingLabel="Creating..."
          />
        </form>
    </ModalShell>
  );
}

export default CreatePurchaseOrderForm;
