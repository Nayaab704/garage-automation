import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { formControlClassNames } from "../ui/uiStyles";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";

const emptyForm = {
  customer_name: "",
  customer_phone: "",
  sale_price: "",
  sale_date: new Date().toISOString().slice(0, 10),
  payment_method: "",
  warranty_type: "",
  warranty_start_date: "",
  warranty_end_date: "",
  warranty_terms: "",
  notes: "",
};

function emptyToNull(value) {
  const trimmedValue = value.trim();
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
      formData.warranty_terms.trim()
  );
}

function SellVehicleForm({
  onActivityLogged,
  onClose,
  onVehicleSold,
  vehicle,
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

      const saleId = saleResponse.data.id;
      let warrantyRecord = null;

      if (hasWarrantyDetails(formData)) {
        const warranty = {
          sale_id: saleId,
          warranty_type: emptyToNull(formData.warranty_type),
          start_date: emptyToNull(formData.warranty_start_date),
          end_date: emptyToNull(formData.warranty_end_date),
          terms: emptyToNull(formData.warranty_terms),
        };

        const warrantyResponse = await supabase
          .from("warranties")
          .insert([warranty])
          .select("*")
          .single();

        if (warrantyResponse.error) {
          console.error("Could not sell vehicle:", warrantyResponse.error);
          setErrorMessage("Could not sell vehicle. Please try again.");
          return;
        }

        warrantyRecord = warrantyResponse.data ?? warranty;
      }

      setSuccessMessage("Vehicle sold successfully.");
      await logVehicleActivity({
        vehicleId: vehicle.id,
        action: "Vehicle sold",
        details: {
          customer_name: sale.customer_name,
          sale_price: sale.sale_price,
          sale_date: sale.sale_date,
          payment_method: sale.payment_method,
          warranty_created: hasWarrantyDetails(formData),
        },
      });
      onActivityLogged?.();
      await onVehicleSold({
        sale: saleResponse.data ?? sale,
        vehicle,
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
      description="Record sale details and optional warranty coverage."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      size="lg"
      title="Sell Vehicle"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <fieldset className="space-y-4">
            <legend className="text-sm font-black text-slate-950">
              Customer / Sale Details
            </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="sale-customer-name">
              <span className={formControlClassNames.label}>
                Customer Name
              </span>
              <input
                className={formControlClassNames.input}
                id="sale-customer-name"
                name="customer_name"
                onChange={handleChange}
                required
                type="text"
                value={formData.customer_name}
              />
            </label>

            <label className="block" htmlFor="sale-customer-phone">
              <span className={formControlClassNames.label}>
                Customer Phone
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

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block" htmlFor="warranty-type">
                <span className={formControlClassNames.label}>
                  Warranty Type
                </span>
                <input
                  className={formControlClassNames.input}
                  id="warranty-type"
                  name="warranty_type"
                  onChange={handleChange}
                  type="text"
                  value={formData.warranty_type}
                />
              </label>

              <label className="block" htmlFor="warranty-start-date">
                <span className={formControlClassNames.label}>
                  Start Date
                </span>
                <input
                  className={formControlClassNames.input}
                  id="warranty-start-date"
                  name="warranty_start_date"
                  onChange={handleChange}
                  type="date"
                  value={formData.warranty_start_date}
                />
              </label>

              <label className="block" htmlFor="warranty-end-date">
                <span className={formControlClassNames.label}>
                  End Date
                </span>
                <input
                  className={formControlClassNames.input}
                  id="warranty-end-date"
                  name="warranty_end_date"
                  onChange={handleChange}
                  type="date"
                  value={formData.warranty_end_date}
                />
              </label>
            </div>

            <label className="mt-4 block" htmlFor="warranty-terms">
              <span className={formControlClassNames.label}>
                Warranty Terms
              </span>
              <textarea
                className={formControlClassNames.textarea}
                id="warranty-terms"
                name="warranty_terms"
                onChange={handleChange}
                value={formData.warranty_terms}
              />
            </label>
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
            submitLabel="Sell Vehicle"
            submittingLabel="Selling..."
          />
        </form>
    </ModalShell>
  );
}

export default SellVehicleForm;
