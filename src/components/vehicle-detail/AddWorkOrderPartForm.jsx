import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { formControlClassNames } from "../ui/uiStyles";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";
import { linkVendorPartQuoteToPartRequest } from "../../lib/vendorPriceMemory";
import VendorPriceSuggestions from "./VendorPriceSuggestions";

const emptyForm = {
  part_name: "",
  quantity: "1",
  part_source: "in_house",
  unit_cost: "",
  notes: "",
};

const partSourceOptions = [
  { value: "in_house", label: "In-house / Available" },
  { value: "needs_to_buy", label: "Needs to Buy" },
];

const allowedPartSources = partSourceOptions.map((option) => option.value);

function emptyToNull(value) {
  const trimmedValue = String(value ?? "").trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function getValidPartSource(value) {
  return allowedPartSources.includes(value) ? value : "in_house";
}

function getPartApprovalValues(partSource) {
  if (partSource === "needs_to_buy") {
    return {
      approval_status: "pending",
      status: "requested",
    };
  }

  return {
    approval_status: "not_required",
    status: "received",
  };
}

function getWorkOrderTitle(workOrder) {
  return workOrder?.title || workOrder?.name || "Work Order";
}

function getQuoteField(quote, snakeCaseField, camelCaseField) {
  return quote?.[snakeCaseField] ?? quote?.[camelCaseField] ?? null;
}

function getQuoteVendorId(quote) {
  return getQuoteField(quote, "vendor_id", "vendorId");
}

function getQuoteUnitPrice(quote) {
  const value = getQuoteField(quote, "unit_price", "unitPrice");
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getQuoteTotalPrice(quote, quantity) {
  const savedTotal = getQuoteField(quote, "total_price", "totalPrice");

  if (savedTotal !== null && savedTotal !== undefined) {
    const savedTotalNumber = Number(savedTotal);

    if (Number.isFinite(savedTotalNumber)) {
      return savedTotalNumber;
    }
  }

  const unitPrice = getQuoteUnitPrice(quote);
  const quantityNumber = Number(quantity || 1);
  const safeQuantity =
    Number.isFinite(quantityNumber) && quantityNumber > 0 ? quantityNumber : 1;

  return unitPrice === null ? null : unitPrice * safeQuantity;
}

function normalizeSelectedQuote(quote) {
  if (!quote?.id) {
    return null;
  }

  return {
    ...quote,
    part_request_id: getQuoteField(quote, "part_request_id", "partRequestId"),
    total_price: getQuoteField(quote, "total_price", "totalPrice"),
    unit_price: getQuoteField(quote, "unit_price", "unitPrice"),
    vendor_id: getQuoteVendorId(quote),
    vendor_name_snapshot:
      getQuoteField(quote, "vendor_name_snapshot", "vendorNameSnapshot") ??
      quote.vendor_name ??
      quote.display_vendor_name ??
      null,
  };
}

function getSelectedQuotePartFields(selectedQuote, quantity) {
  if (!selectedQuote?.id) {
    return {
      quoted_total_cost: null,
      quoted_unit_cost: null,
      selected_quote_id: null,
      selected_vendor_id: null,
    };
  }

  return {
    quoted_total_cost: getQuoteTotalPrice(selectedQuote, quantity),
    quoted_unit_cost: getQuoteUnitPrice(selectedQuote),
    selected_quote_id: selectedQuote.id,
    selected_vendor_id: getQuoteVendorId(selectedQuote),
  };
}

function AddWorkOrderPartForm({
  currentProfile,
  onActivityLogged,
  onClose,
  onPartAdded,
  vehicle,
  vehicleId,
  vendors = [],
  workOrder,
}) {
  const [formData, setFormData] = useState(emptyForm);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "part_name" || name === "unit_cost") {
      setSelectedQuote(null);
    }

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function handleUseVendorQuote(quote) {
    const normalizedQuote = normalizeSelectedQuote(quote);
    const vendorId = getQuoteVendorId(normalizedQuote);
    const unitPrice = getQuoteUnitPrice(normalizedQuote);

    console.log("Add Part selected quote", {
      quoteId: normalizedQuote?.id,
      unitPrice,
      vendorId,
    });

    if (!normalizedQuote?.id) {
      return;
    }

    if (!vendorId) {
      setErrorMessage(
        "This quote has no linked vendor, so it cannot be selected for PO."
      );
      return;
    }

    setSelectedQuote(normalizedQuote);
    setErrorMessage("");
    setFormData((currentFormData) => ({
      ...currentFormData,
      unit_cost: unitPrice === null ? currentFormData.unit_cost : String(unitPrice),
    }));
  }

  function handleQuoteSaved(quote) {
    handleUseVendorQuote(quote);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const partName = emptyToNull(formData.part_name);
    const quantity = Number(formData.quantity || 1);
    const unitCost = Number(formData.unit_cost || 0);
    const partSource = getValidPartSource(formData.part_source);
    const approvalValues = getPartApprovalValues(partSource);

    if (!partName) {
      setErrorMessage("Part name is required.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity < 1) {
      setErrorMessage("Quantity must be at least 1.");
      return;
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setErrorMessage("Unit cost must be 0 or greater.");
      return;
    }

    if (!vehicleId || !workOrder?.id) {
      setErrorMessage("Unable to add a part without a work order.");
      return;
    }

    const selectedQuoteFields = getSelectedQuotePartFields(
      selectedQuote,
      quantity
    );

    if (selectedQuote?.id && !selectedQuoteFields.selected_vendor_id) {
      setErrorMessage(
        "This quote has no linked vendor, so it cannot be selected for PO."
      );
      return;
    }

    console.log("Saving part with selected quote", {
      quotedTotalCost: selectedQuoteFields.quoted_total_cost,
      quotedUnitCost: selectedQuoteFields.quoted_unit_cost,
      selectedQuoteId: selectedQuoteFields.selected_quote_id,
      selectedVendorId: selectedQuoteFields.selected_vendor_id,
    });

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const partRequest = {
        vehicle_id: vehicleId,
        repair_job_id: workOrder.id,
        part_name: partName,
        quantity,
        part_source: partSource,
        unit_cost: unitCost,
        notes: emptyToNull(formData.notes),
        created_by: currentProfile?.id ?? null,
        ...selectedQuoteFields,
        ...approvalValues,
      };

      const { data, error } = await supabase
        .from("part_requests")
        .insert([partRequest])
        .select("*")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (selectedQuote?.id && data?.id && !selectedQuote.part_request_id) {
        const linkResult = await linkVendorPartQuoteToPartRequest({
          partRequestId: data.id,
          quoteId: selectedQuote.id,
          repairJobId: workOrder.id,
          vehicleId,
        });

        if (linkResult.error) {
          console.error(
            "Part was added, but vendor quote history could not be linked:",
            linkResult.error
          );
        }
      }

      setFormData(emptyForm);
      setSelectedQuote(null);
      setSuccessMessage("Part added successfully.");
      await logVehicleActivity({
        vehicleId,
        action: "Part request created",
        details: {
          part_name: partRequest.part_name,
          quantity: partRequest.quantity,
          part_source: partRequest.part_source,
          work_order: getWorkOrderTitle(workOrder),
        },
      });
      onActivityLogged?.();
      await onPartAdded?.(data ?? partRequest);
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="Add a required part directly to this work order."
      eyebrow={getWorkOrderTitle(workOrder)}
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      title="Add Part"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block" htmlFor="work-order-part-name">
            <span className={formControlClassNames.label}>Part Name</span>
            <input
              className={formControlClassNames.input}
              id="work-order-part-name"
              name="part_name"
              onChange={handleChange}
              required
              type="text"
              value={formData.part_name}
            />
          </label>

          <VendorPriceSuggestions
            currentProfile={currentProfile}
            onQuoteSaved={handleQuoteSaved}
            onUseQuote={handleUseVendorQuote}
            partName={formData.part_name}
            quantity={formData.quantity}
            selectedQuote={selectedQuote}
            vehicle={vehicle}
            vendors={vendors}
            workOrder={workOrder}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block" htmlFor="work-order-part-quantity">
              <span className={formControlClassNames.label}>Quantity</span>
              <input
                className={formControlClassNames.input}
                id="work-order-part-quantity"
                min="1"
                name="quantity"
                onChange={handleChange}
                step="1"
                type="number"
                value={formData.quantity}
              />
            </label>

            <label className="block sm:col-span-2" htmlFor="work-order-part-source">
              <span className={formControlClassNames.label}>Part Source</span>
              <select
                className={formControlClassNames.select}
                id="work-order-part-source"
                name="part_source"
                onChange={handleChange}
                value={formData.part_source}
              >
                {partSourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block" htmlFor="work-order-part-unit-cost">
            <span className={formControlClassNames.label}>Unit Cost</span>
            <input
              className={formControlClassNames.input}
              id="work-order-part-unit-cost"
              min="0"
              name="unit_cost"
              onChange={handleChange}
              step="0.01"
              type="number"
              value={formData.unit_cost}
            />
          </label>

          <label className="block" htmlFor="work-order-part-notes">
            <span className={formControlClassNames.label}>Notes</span>
            <textarea
              className={formControlClassNames.textarea}
              id="work-order-part-notes"
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
            submitLabel="Add Part"
            submittingLabel="Adding..."
          />
        </form>
    </ModalShell>
  );
}

export default AddWorkOrderPartForm;
