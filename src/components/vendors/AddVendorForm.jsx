import { useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { formControlClassNames } from "../ui/uiStyles";
import { supabase } from "../../lib/supabaseClient";

const vendorTypeOptions = [
  { value: "parts", label: "Parts Supplier" },
  { value: "service", label: "Service / Repair Vendor" },
  { value: "auction", label: "Auction / Source" },
  { value: "other", label: "Other" },
];

const emptyForm = {
  address: "",
  email: "",
  name: "",
  notes: "",
  phone: "",
  vendor_type: "parts",
};

function emptyToNull(value) {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
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

function AddVendorForm({ onClose, onVendorAdded }) {
  const [formData, setFormData] = useState(emptyForm);
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
        .insert([vendorPayload])
        .select("id, name, phone, email, address, vendor_type, notes, created_at")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      onVendorAdded?.(data);
      onClose();
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="Create a vendor record for parts, services, auctions, or other garage needs."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      size="lg"
      title="Add Vendor"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="vendor-name">
              <span className={formControlClassNames.label}>Vendor Name</span>
              <input
                className={formControlClassNames.input}
                id="vendor-name"
                name="name"
                onChange={handleChange}
                required
                type="text"
                value={formData.name}
              />
            </label>

            <label className="block" htmlFor="vendor-type">
              <span className={formControlClassNames.label}>Vendor Type</span>
              <select
                className={formControlClassNames.select}
                id="vendor-type"
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

            <label className="block" htmlFor="vendor-phone">
              <span className={formControlClassNames.label}>Phone</span>
              <input
                className={formControlClassNames.input}
                id="vendor-phone"
                name="phone"
                onChange={handleChange}
                type="tel"
                value={formData.phone}
              />
            </label>

            <label className="block" htmlFor="vendor-email">
              <span className={formControlClassNames.label}>Email</span>
              <input
                className={formControlClassNames.input}
                id="vendor-email"
                name="email"
                onChange={handleChange}
                type="email"
                value={formData.email}
              />
            </label>
          </div>

          <label className="block" htmlFor="vendor-address">
            <span className={formControlClassNames.label}>Address</span>
            <input
              className={formControlClassNames.input}
              id="vendor-address"
              name="address"
              onChange={handleChange}
              type="text"
              value={formData.address}
            />
          </label>

          <label className="block" htmlFor="vendor-notes">
            <span className={formControlClassNames.label}>Notes</span>
            <textarea
              className={formControlClassNames.textarea}
              id="vendor-notes"
              name="notes"
              onChange={handleChange}
              value={formData.notes}
            />
          </label>

          <FormMessage tone="error">{errorMessage}</FormMessage>

          <FormActions
            isSubmitting={isSubmitting}
            onCancel={onClose}
            submitLabel="Add Vendor"
            submittingLabel="Adding..."
          />
        </form>
    </ModalShell>
  );
}

export default AddVendorForm;
