import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import WarrantyPeriodFields from "./WarrantyPeriodFields";
import { formControlClassNames } from "../ui/uiStyles";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";
import {
  DEFAULT_WARRANTY_MONTHS,
  addWarrantyMonths,
  createWarrantyRecordValues,
  getTodayDateValue,
  normalizeWarrantyMonths,
} from "../../lib/warranty";

function createEmptyForm() {
  const today = getTodayDateValue();

  return {
    customer_name: "",
    customer_phone: "",
    sale_price: "",
    sale_date: today,
    payment_method: "",
    warranty_type: "",
    warranty_start_date: today,
    warranty_months: DEFAULT_WARRANTY_MONTHS,
    warranty_end_date: addWarrantyMonths(today, DEFAULT_WARRANTY_MONTHS),
    warranty_notes: "",
    notes: "",
  };
}

function emptyToNull(value) {
  const trimmedValue = String(value ?? "").trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function parseSalePrice(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return { error: "Sale price must be greater than 0.", value: null };
  }

  return { error: "", value: numberValue };
}

function hasWarrantyDetails(formData) {
  return Boolean(
    formData.warranty_type.trim() ||
      formData.warranty_start_date ||
      formData.warranty_end_date ||
      formData.warranty_notes.trim()
  );
}

function createWarrantyValues(formData, saleId) {
  return createWarrantyRecordValues({
    endDate: formData.warranty_end_date,
    months: formData.warranty_months,
    notes: formData.warranty_notes,
    saleId,
    startDate: formData.warranty_start_date,
    type: formData.warranty_type,
  });
}

function SellVehicleForm({
  onActivityLogged,
  onClose,
  onVehicleSold,
  vehicle,
}) {
  const [formData, setFormData] = useState(createEmptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [partialSaleId, setPartialSaleId] = useState(null);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => {
      if (name === "sale_date") {
        const shouldFollowSaleDate =
          !currentFormData.warranty_start_date ||
          currentFormData.warranty_start_date === currentFormData.sale_date;
        const warrantyStartDate = shouldFollowSaleDate
          ? value
          : currentFormData.warranty_start_date;

        return {
          ...currentFormData,
          sale_date: value,
          warranty_end_date: addWarrantyMonths(
            warrantyStartDate,
            currentFormData.warranty_months
          ),
          warranty_start_date: warrantyStartDate,
        };
      }

      return {
        ...currentFormData,
        [name]: value,
      };
    });
  }

  function updateWarrantyPeriod({
    months = formData.warranty_months,
    startDate = formData.warranty_start_date,
  }) {
    const normalizedMonths = normalizeWarrantyMonths(months);

    setFormData((currentFormData) => ({
      ...currentFormData,
      warranty_end_date: addWarrantyMonths(startDate, normalizedMonths),
      warranty_months: normalizedMonths,
      warranty_start_date: startDate,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!vehicle.id) {
      setErrorMessage("Unable to sell a vehicle without an ID.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const salePrice = parseSalePrice(formData.sale_price);

      if (salePrice.error) {
        setErrorMessage(salePrice.error);
        return;
      }

      const existingSaleResponse = await supabase
        .from("sales")
        .select("*")
        .eq("vehicle_id", vehicle.id)
        .order("sale_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSaleResponse.error) {
        console.error("Could not check vehicle sale:", existingSaleResponse.error);
        setErrorMessage("Could not verify sale status. Please try again.");
        return;
      }

      if (existingSaleResponse.data) {
        if (partialSaleId !== existingSaleResponse.data.id) {
          await onVehicleSold({
            sale: existingSaleResponse.data,
            vehicle: { ...vehicle, sale_status: "sold" },
            warranty: null,
          });
          setErrorMessage(
            "This vehicle was already sold. The values in this form were not saved. Close this form and review the existing sale."
          );
          return;
        }

        let existingWarranty = null;

        if (hasWarrantyDetails(formData) && existingSaleResponse.data.id) {
          const existingWarrantyResponse = await supabase
            .from("warranties")
            .select("*")
            .eq("sale_id", existingSaleResponse.data.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingWarrantyResponse.error) {
            console.error(
              "Could not check vehicle warranty:",
              existingWarrantyResponse.error
            );
            setErrorMessage("Could not verify warranty details. Please try again.");
            return;
          }

          existingWarranty = existingWarrantyResponse.data;

          if (!existingWarranty) {
            const warrantyResponse = await supabase
              .from("warranties")
              .insert([
                createWarrantyValues(formData, existingSaleResponse.data.id),
              ])
              .select("*")
              .single();

            if (warrantyResponse.error) {
              console.error("Could not save vehicle warranty:", warrantyResponse.error);
              setErrorMessage(
                "The sale is saved, but the warranty could not be saved. Please try again."
              );
              return;
            }

            existingWarranty = warrantyResponse.data;
          }
        }

        await onVehicleSold({
          sale: existingSaleResponse.data,
          vehicle: { ...vehicle, sale_status: "sold" },
          warranty: existingWarranty,
        });
        onClose();
        return;
      }

      const sale = {
        vehicle_id: vehicle.id,
        customer_name: emptyToNull(formData.customer_name),
        customer_phone: emptyToNull(formData.customer_phone),
        sale_price: salePrice.value,
        sale_date: emptyToNull(formData.sale_date),
        payment_method: emptyToNull(formData.payment_method),
        notes: emptyToNull(formData.notes),
      };

      const saleResponse = await supabase
        .from("sales")
        .insert([sale])
        .select("*")
        .single();

      if (saleResponse.error) {
        console.error("Could not sell vehicle:", saleResponse.error);
        setErrorMessage("Could not sell vehicle. Please try again.");
        return;
      }

      const vehicleResponse = await supabase
        .from("vehicles")
        .update({ sale_status: "sold" })
        .eq("id", vehicle.id)
        .select("*")
        .single();

      if (vehicleResponse.error) {
        console.error("Could not update vehicle sale status:", vehicleResponse.error);
      }

      const saleRecord = saleResponse.data ?? sale;
      const saleId = saleRecord.id;
      const soldVehicle =
        vehicleResponse.data ?? { ...vehicle, sale_status: "sold" };
      let warrantyRecord = null;

      await logVehicleActivity({
        vehicleId: vehicle.id,
        action: "Vehicle sold",
        details: {
          sale_date: sale.sale_date,
        },
      });
      onActivityLogged?.();

      if (hasWarrantyDetails(formData) && saleId) {
        const warranty = createWarrantyValues(formData, saleId);

        const warrantyResponse = await supabase
          .from("warranties")
          .insert([warranty])
          .select("*")
          .single();

        if (warrantyResponse.error) {
          console.error("Could not save vehicle warranty:", warrantyResponse.error);
            setErrorMessage(
              "The sale is saved, but the warranty could not be saved. Please try again."
            );
            setPartialSaleId(saleId);
            await onVehicleSold({
            sale: saleRecord,
            vehicle: soldVehicle,
            warranty: null,
          });
          return;
        }

        warrantyRecord = warrantyResponse.data ?? warranty;
      }

      setSuccessMessage("Vehicle sold successfully.");
      await onVehicleSold({
        sale: saleRecord,
        vehicle: soldVehicle,
        warranty: warrantyRecord,
      });
      onClose();
    } catch (error) {
      console.error("Could not sell vehicle:", error);
      setErrorMessage("Could not sell vehicle. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="Record sale details and choose a warranty period."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      size="lg"
      title="Mark Vehicle Sold"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <fieldset className="space-y-4">
            <legend className="text-sm font-black text-slate-950">
              Customer / Sale Details
            </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="sale-customer-name">
              <span className={formControlClassNames.label}>
                Buyer Name
              </span>
              <input
                className={formControlClassNames.input}
                id="sale-customer-name"
                name="customer_name"
                onChange={handleChange}
                type="text"
                value={formData.customer_name}
              />
            </label>

            <label className="block" htmlFor="sale-customer-phone">
              <span className={formControlClassNames.label}>
                Buyer Phone
              </span>
              <input
                className={formControlClassNames.input}
                id="sale-customer-phone"
                name="customer_phone"
                onChange={handleChange}
                type="tel"
                value={formData.customer_phone}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block" htmlFor="sale-price">
              <span className={formControlClassNames.label}>
                Sale Price
              </span>
              <input
                className={formControlClassNames.input}
                id="sale-price"
                min="0.01"
                name="sale_price"
                onChange={handleChange}
                required
                step="0.01"
                type="number"
                value={formData.sale_price}
              />
            </label>

            <label className="block" htmlFor="sale-date">
              <span className={formControlClassNames.label}>
                Sale Date
              </span>
              <input
                className={formControlClassNames.input}
                id="sale-date"
                name="sale_date"
                onChange={handleChange}
                required
                type="date"
                value={formData.sale_date}
              />
            </label>

            <label className="block" htmlFor="payment-method">
              <span className={formControlClassNames.label}>
                Payment Method
              </span>
              <input
                className={formControlClassNames.input}
                id="payment-method"
                name="payment_method"
                onChange={handleChange}
                type="text"
                value={formData.payment_method}
              />
            </label>
          </div>
          </fieldset>

          <fieldset className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
            <legend className="px-1 text-sm font-black text-slate-950">
              Warranty
            </legend>

            <WarrantyPeriodFields
              endDate={formData.warranty_end_date}
              idPrefix="sale-warranty"
              months={formData.warranty_months}
              notes={formData.warranty_notes}
              onMonthsChange={(months) => updateWarrantyPeriod({ months })}
              onNotesChange={(warranty_notes) =>
                setFormData((currentFormData) => ({
                  ...currentFormData,
                  warranty_notes,
                }))
              }
              onStartDateChange={(startDate) =>
                updateWarrantyPeriod({ startDate })
              }
              onTypeChange={(warranty_type) =>
                setFormData((currentFormData) => ({
                  ...currentFormData,
                  warranty_type,
                }))
              }
              startDate={formData.warranty_start_date}
              type={formData.warranty_type}
            />
          </fieldset>

          <label className="block" htmlFor="sale-notes">
            <span className={formControlClassNames.label}>Notes</span>
            <textarea
              className={formControlClassNames.textarea}
              id="sale-notes"
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
            submitLabel="Save Sale / Mark Vehicle Sold"
            submittingLabel="Saving sale..."
          />
        </form>
    </ModalShell>
  );
}

export default SellVehicleForm;
