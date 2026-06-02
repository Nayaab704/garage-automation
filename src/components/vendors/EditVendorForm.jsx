import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const vendorTypeOptions = [
  { value: "parts", label: "Parts Supplier" },
  { value: "service", label: "Service / Repair Vendor" },
  { value: "auction", label: "Auction / Source" },
  { value: "other", label: "Other" },
];

function emptyToNull(value) {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function valueToString(value) {
  return value === null || value === undefined ? "" : String(value);
}

function getInitialFormData(vendor) {
  return {
    address: valueToString(vendor.address),
    email: valueToString(vendor.email),
    name: valueToString(vendor.name),
    notes: valueToString(vendor.notes),
    phone: valueToString(vendor.phone),
    vendor_type: vendor.vendor_type ?? "other",
  };
}

function buildVendorPayload(formData) {
  return {
    address: emptyToNull(formData.address),
    email: emptyToNull(formData.email),
    name: formData.name.trim(),
    notes: emptyToNull(formData.notes),
    phone: emptyToNull(formData.phone),
    vendor_type: formData.vendor_type,
  };
}

function EditVendorForm({ onClose, onVendorUpdated, vendor }) {
  const [formData, setFormData] = useState(() => getInitialFormData(vendor));
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!vendor?.id) {
      setErrorMessage("Unable to update a vendor without an ID.");
      return;
    }

    const vendorPayload = buildVendorPayload(formData);

    if (!vendorPayload.name) {
      setErrorMessage("Vendor name is required.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("vendors")
        .update(vendorPayload)
        .eq("id", vendor.id)
        .select("id, name, phone, email, address, vendor_type, notes, created_at")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      onVendorUpdated?.(data);
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
            <h3 className="text-lg font-bold text-zinc-950">Edit Vendor</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Update vendor contact details and classification.
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
            <label className="block" htmlFor="edit-vendor-name">
              <span className="text-sm font-medium text-zinc-700">
                Vendor Name
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="edit-vendor-name"
                name="name"
                onChange={handleChange}
                required
                type="text"
                value={formData.name}
              />
            </label>

            <label className="block" htmlFor="edit-vendor-type">
              <span className="text-sm font-medium text-zinc-700">
                Vendor Type
              </span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="edit-vendor-type"
                name="vendor_type"
                onChange={handleChange}
                value={formData.vendor_type}
              >
                {vendorTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block" htmlFor="edit-vendor-phone">
              <span className="text-sm font-medium text-zinc-700">Phone</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="edit-vendor-phone"
                name="phone"
                onChange={handleChange}
                type="tel"
                value={formData.phone}
              />
            </label>

            <label className="block" htmlFor="edit-vendor-email">
              <span className="text-sm font-medium text-zinc-700">Email</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
                id="edit-vendor-email"
                name="email"
                onChange={handleChange}
                type="email"
                value={formData.email}
              />
            </label>
          </div>

          <label className="block" htmlFor="edit-vendor-address">
            <span className="text-sm font-medium text-zinc-700">Address</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="edit-vendor-address"
              name="address"
              onChange={handleChange}
              type="text"
              value={formData.address}
            />
          </label>

          <label className="block" htmlFor="edit-vendor-notes">
            <span className="text-sm font-medium text-zinc-700">Notes</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="edit-vendor-notes"
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
              {isSubmitting ? "Saving..." : "Save Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditVendorForm;
