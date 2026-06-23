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

    if (isSubmitting) {
      return;
    }

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
        console.error("Could not save vendor:", error);
        setErrorMessage("Could not save vendor. Please try again.");
        return;
      }

      onVendorUpdated?.(data);
      onClose();
    } catch (error) {
      console.error("Could not save vendor:", error);
      setErrorMessage("Could not save vendor. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      description="Update vendor contact details and classification."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      size="lg"
      title="Edit Vendor"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="edit-vendor-name">
              <span className={formControlClassNames.label}>Vendor Name</span>
              <input
                className={formControlClassNames.input}
                id="edit-vendor-name"
                name="name"
                onChange={handleChange}
                required
                type="text"
                value={formData.name}
              />
            </label>

            <label className="block" htmlFor="edit-vendor-type">
              <span className={formControlClassNames.label}>Vendor Type</span>
              <select
                className={formControlClassNames.select}
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
              <span className={formControlClassNames.label}>Phone</span>
              <input
                className={formControlClassNames.input}
                id="edit-vendor-phone"
                name="phone"
                onChange={handleChange}
                type="tel"
                value={formData.phone}
              />
            </label>

            <label className="block" htmlFor="edit-vendor-email">
              <span className={formControlClassNames.label}>Email</span>
              <input
                className={formControlClassNames.input}
                id="edit-vendor-email"
                name="email"
                onChange={handleChange}
                type="email"
                value={formData.email}
              />
            </label>
          </div>

          <label className="block" htmlFor="edit-vendor-address">
            <span className={formControlClassNames.label}>Address</span>
            <input
              className={formControlClassNames.input}
              id="edit-vendor-address"
              name="address"
              onChange={handleChange}
              type="text"
              value={formData.address}
            />
          </label>

          <label className="block" htmlFor="edit-vendor-notes">
            <span className={formControlClassNames.label}>Notes</span>
            <textarea
              className={formControlClassNames.textarea}
              id="edit-vendor-notes"
              name="notes"
              onChange={handleChange}
              value={formData.notes}
            />
          </label>

          <FormMessage tone="error">{errorMessage}</FormMessage>

          <FormActions
            isSubmitting={isSubmitting}
            onCancel={onClose}
            submitLabel="Save Vendor"
            submittingLabel="Saving vendor..."
          />
        </form>
    </ModalShell>
  );
}

export default EditVendorForm;
