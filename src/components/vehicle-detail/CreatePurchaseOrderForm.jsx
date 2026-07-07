import { useMemo, useRef, useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { formControlClassNames } from "../ui/uiStyles";
import { logVehicleActivity } from "../../lib/activityLogger";
import { isPartNeedsPo } from "../../lib/partWorkflowUtils";
import { supabase } from "../../lib/supabaseClient";

const emptyForm = {
  vendor_id: "",
  part_request_id: "",
  description: "",
  quantity: "1",
  unit_cost: "",
  shipping_cost: "100",
  tax: "",
  notes: "",
};

const partRequestResultColumns =
  "id, vehicle_id, repair_job_id, part_name, quantity, status, notes, part_source, approval_status, approved_by, approved_at, unit_cost, selected_vendor_id, selected_quote_id, quoted_unit_cost, quoted_total_cost, created_by, created_at";

const DEFAULT_SHIPPING_COST = 100;
const SHIPPING_QUICK_OPTIONS = [0, 50, DEFAULT_SHIPPING_COST, 150];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US");

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

function getSafeNumber(value, defaultValue = 0) {
  const trimmedValue = String(value ?? "").trim();

  if (trimmedValue === "") {
    return defaultValue;
  }

  const numberValue = Number(trimmedValue);

  return Number.isFinite(numberValue) && numberValue >= 0
    ? numberValue
    : defaultValue;
}

function formatCurrency(value) {
  return currencyFormatter.format(getSafeNumber(value));
}

function formatNumber(value) {
  return numberFormatter.format(getSafeNumber(value));
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
  return isPartNeedsPo(partRequest);
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

function getShippingSelection(value) {
  const trimmedValue = String(value ?? "").trim();

  if (trimmedValue === "") {
    return "custom";
  }

  const numberValue = Number(trimmedValue);

  return SHIPPING_QUICK_OPTIONS.includes(numberValue) ? numberValue : "custom";
}

function parseUnitCost(value) {
  const trimmedValue = String(value ?? "").trim();
  const numberValue = Number(trimmedValue);

  if (trimmedValue === "" || !Number.isFinite(numberValue) || numberValue < 0) {
    return { error: "Please enter a valid unit cost.", value: null };
  }

  return { error: "", value: numberValue };
}

function parseOptionalCost(value, invalidMessage, negativeMessage) {
  const trimmedValue = String(value ?? "").trim();

  if (trimmedValue === "") {
    return { error: "", value: 0 };
  }

  const numberValue = Number(trimmedValue);

  if (!Number.isFinite(numberValue)) {
    return { error: invalidMessage, value: null };
  }

  if (numberValue < 0) {
    return { error: negativeMessage, value: null };
  }

  return { error: "", value: numberValue };
}

function getCostSummary(formData) {
  const quantity = getSafeNumber(formData.quantity, 1);
  const unitCost = getSafeNumber(formData.unit_cost);
  const shippingCost = getSafeNumber(formData.shipping_cost);
  const tax = getSafeNumber(formData.tax);
  const subtotal = quantity * unitCost;

  return {
    quantity,
    shippingCost,
    subtotal,
    tax,
    total: subtotal + shippingCost + tax,
    unitCost,
  };
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
  const [selectedShippingOption, setSelectedShippingOption] = useState(() =>
    getShippingSelection(initialFormData.shipping_cost)
  );
  const shippingInputRef = useRef(null);
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
  const costSummary = useMemo(() => getCostSummary(formData), [formData]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));

    if (name === "shipping_cost") {
      setSelectedShippingOption(getShippingSelection(value));
    }
  }

  function handleShippingQuickSelect(value) {
    setSelectedShippingOption(value);
    setFormData((currentFormData) => ({
      ...currentFormData,
      shipping_cost: String(value),
    }));
  }

  function handleCustomShippingSelect() {
    setSelectedShippingOption("custom");
    window.requestAnimationFrame(() => {
      shippingInputRef.current?.focus();
      shippingInputRef.current?.select();
    });
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
    const unitCost = parseUnitCost(formData.unit_cost);
    const shippingCost = parseOptionalCost(
      formData.shipping_cost,
      "Please enter a valid shipping cost.",
      "Shipping cannot be negative."
    );
    const tax = parseOptionalCost(
      formData.tax,
      "Please enter a valid tax amount.",
      "Tax cannot be negative."
    );

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

    if (isSubmitting) {
      return;
    }

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
        console.error("Could not check duplicate purchase orders:", duplicateCheck.error);
        setErrorMessage("Could not create purchase order. Please try again.");
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
        .select("*")
        .single();

      if (purchaseOrderResponse.error) {
        console.error("Could not create purchase order:", purchaseOrderResponse.error);
        setErrorMessage("Could not create purchase order. Please try again.");
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
        .select("*")
        .single();

      if (itemResponse.error) {
        console.error("Could not create purchase order item:", itemResponse.error);
        const cleanupResponse = await supabase
          .from("purchase_orders")
          .delete()
          .eq("id", purchaseOrderId);

        if (cleanupResponse.error) {
          console.error(
            "Could not remove empty purchase order after item create failed:",
            cleanupResponse.error
          );
        }

        setErrorMessage("Could not create purchase order. Please try again.");
        return;
      }

      const partRequestResponse = await supabase
        .from("part_requests")
        .update({ status: "ordered" })
        .eq("id", formData.part_request_id)
        .select(partRequestResultColumns)
        .single();

      let statusWarning = "";
      const selectedPartRequest = partRequests.find(
        (partRequest) => partRequest.id === formData.part_request_id
      );

      if (partRequestResponse.error) {
        console.error(
          "Purchase order created, but part request status could not be updated:",
          partRequestResponse.error
        );
        statusWarning =
          "Purchase order created, but the part status could not be updated.";
      }
      const partRequestStatusUpdated = !partRequestResponse.error;

      setFormData(initialFormData);
      setSelectedShippingOption(getShippingSelection(initialFormData.shipping_cost));
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
        partRequest:
          partRequestResponse.data ??
          (partRequestStatusUpdated
            ? { ...selectedPartRequest, status: "ordered" }
            : selectedPartRequest),
        partRequestId: formData.part_request_id,
        partRequestStatusUpdated,
        purchaseOrder: purchaseOrderResponse.data ?? {
          ...purchaseOrder,
          id: purchaseOrderId,
        },
        purchaseOrderItem: itemResponse.data ?? purchaseOrderItem,
        purchaseOrderItemId: itemResponse.data?.id ?? null,
        purchaseOrderId,
        status: "ordered",
        warningMessage: statusWarning,
      });
    } catch (error) {
      console.error("Could not create purchase order:", error);
      setErrorMessage("Could not create purchase order. Please try again.");
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
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>

            <div>
              <span className={formControlClassNames.label}>Shipping</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {SHIPPING_QUICK_OPTIONS.map((option) => {
                  const isSelected = selectedShippingOption === option;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`inline-flex min-h-10 items-center justify-center rounded-2xl border px-3 py-2 text-sm font-black shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-100 ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                      key={option}
                      onClick={() => handleShippingQuickSelect(option)}
                      type="button"
                    >
                      ${option}
                      {option === DEFAULT_SHIPPING_COST ? " Default" : ""}
                    </button>
                  );
                })}
                <button
                  aria-pressed={selectedShippingOption === "custom"}
                  className={`inline-flex min-h-10 items-center justify-center rounded-2xl border px-3 py-2 text-sm font-black shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-100 ${
                    selectedShippingOption === "custom"
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  onClick={handleCustomShippingSelect}
                  type="button"
                >
                  Custom
                </button>
              </div>

              <label className="mt-3 block" htmlFor="purchase-order-shipping">
                <span className="sr-only">Shipping amount</span>
                <input
                  className={formControlClassNames.input}
                  id="purchase-order-shipping"
                  min="0"
                  name="shipping_cost"
                  onChange={handleChange}
                  ref={shippingInputRef}
                  step="0.01"
                  type="number"
                  value={formData.shipping_cost}
                />
              </label>
            </div>

            <label className="block" htmlFor="purchase-order-tax">
              <span className={formControlClassNames.label}>Tax Optional</span>
              <input
                className={formControlClassNames.input}
                id="purchase-order-tax"
                min="0"
                name="tax"
                onChange={handleChange}
                placeholder="Optional"
                step="0.01"
                type="number"
                value={formData.tax}
              />
            </label>

            <div className="space-y-2 border-t border-slate-200 pt-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-600">Subtotal</span>
                <span className="text-right font-black text-slate-950">
                  Qty {formatNumber(costSummary.quantity)} x{" "}
                  {formatCurrency(costSummary.unitCost)} ={" "}
                  {formatCurrency(costSummary.subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-600">Shipping</span>
                <span className="font-black text-slate-950">
                  {formatCurrency(costSummary.shippingCost)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-600">Tax</span>
                <span className="font-black text-slate-950">
                  {formatCurrency(costSummary.tax)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
                <span className="text-base font-black text-slate-950">Total</span>
                <span className="text-xl font-black text-emerald-700">
                  {formatCurrency(costSummary.total)}
                </span>
              </div>
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
            submittingLabel="Creating PO..."
          />
        </form>
    </ModalShell>
  );
}

export default CreatePurchaseOrderForm;
