import { useState } from "react";
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
        .select("id")
        .single();

      if (saleResponse.error) {
        setErrorMessage(saleResponse.error.message);
        return;
      }

      const saleId = saleResponse.data.id;

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
          .insert([warranty]);

        if (warrantyResponse.error) {
          setErrorMessage(warrantyResponse.error.message);
          return;
        }
      }

      const vehicleResponse = await supabase
        .from("vehicles")
        .update({ status: "sold" })
        .eq("id", vehicle.id);

      if (vehicleResponse.error) {
        setErrorMessage(
          `Sale was created, but the vehicle could not be marked sold: ${vehicleResponse.error.message}`
        );
        return;
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
      await onVehicleSold();
      onClose();
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
            <h3 className="text-lg font-bold text-zinc-950">Sell Vehicle</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Record sale details and optional warranty coverage.
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
            <label className="block" htmlFor="sale-customer-name">
              <span className="text-sm font-medium text-zinc-700">
                Customer Name
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="sale-customer-name"
                name="customer_name"
                onChange={handleChange}
                required
                type="text"
                value={formData.customer_name}
              />
            </label>

            <label className="block" htmlFor="sale-customer-phone">
              <span className="text-sm font-medium text-zinc-700">
                Customer Phone
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
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
              <span className="text-sm font-medium text-zinc-700">
                Sale Price
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
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
              <span className="text-sm font-medium text-zinc-700">
                Sale Date
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="sale-date"
                name="sale_date"
                onChange={handleChange}
                required
                type="date"
                value={formData.sale_date}
              />
            </label>

            <label className="block" htmlFor="payment-method">
              <span className="text-sm font-medium text-zinc-700">
                Payment Method
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="payment-method"
                name="payment_method"
                onChange={handleChange}
                type="text"
                value={formData.payment_method}
              />
            </label>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <h4 className="text-sm font-bold text-zinc-950">Warranty</h4>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="block" htmlFor="warranty-type">
                <span className="text-sm font-medium text-zinc-700">
                  Warranty Type
                </span>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                  id="warranty-type"
                  name="warranty_type"
                  onChange={handleChange}
                  type="text"
                  value={formData.warranty_type}
                />
              </label>

              <label className="block" htmlFor="warranty-start-date">
                <span className="text-sm font-medium text-zinc-700">
                  Start Date
                </span>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                  id="warranty-start-date"
                  name="warranty_start_date"
                  onChange={handleChange}
                  type="date"
                  value={formData.warranty_start_date}
                />
              </label>

              <label className="block" htmlFor="warranty-end-date">
                <span className="text-sm font-medium text-zinc-700">
                  End Date
                </span>
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                  id="warranty-end-date"
                  name="warranty_end_date"
                  onChange={handleChange}
                  type="date"
                  value={formData.warranty_end_date}
                />
              </label>
            </div>

            <label className="mt-4 block" htmlFor="warranty-terms">
              <span className="text-sm font-medium text-zinc-700">
                Warranty Terms
              </span>
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="warranty-terms"
                name="warranty_terms"
                onChange={handleChange}
                value={formData.warranty_terms}
              />
            </label>
          </div>

          <label className="block" htmlFor="sale-notes">
            <span className="text-sm font-medium text-zinc-700">Notes</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="sale-notes"
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
              {isSubmitting ? "Selling..." : "Sell Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SellVehicleForm;
