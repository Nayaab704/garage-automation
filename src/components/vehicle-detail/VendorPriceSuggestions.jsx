import { useEffect, useRef, useState } from "react";
import {
  buildVendorPartQuotePayload,
  createVendorPartQuote,
  getVendorQuoteDisplayName,
  normalizePartName,
  searchVendorPartQuotes,
} from "../../lib/vendorPriceMemory";
import AppIcon from "../ui/AppIcon";
import FormMessage from "../ui/FormMessage";
import { buttonClassNames, formControlClassNames } from "../ui/uiStyles";

const availabilityOptions = [
  { value: "unknown", label: "Unknown" },
  { value: "in_stock", label: "In stock" },
  { value: "order_needed", label: "Order needed" },
  { value: "unavailable", label: "Unavailable" },
];

const quoteStatusLabels = {
  purchased: "Bought",
  quoted: "Quoted",
  rejected: "Rejected",
  unavailable: "Unavailable",
};

const availabilityLabels = {
  in_stock: "In stock",
  order_needed: "Order needed",
  unavailable: "Unavailable",
  unknown: "Unknown",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

const initialQuoteForm = {
  availability: "unknown",
  notes: "",
  unit_price: "",
  vendor_id: "",
};

function numberOrZero(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatCurrency(value) {
  return currencyFormatter.format(numberOrZero(value));
}

function formatDate(value) {
  if (!value) {
    return "Date not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not available";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

function formatVehicleSnapshot(quote) {
  const vehicleName = [
    quote.vehicle_year_snapshot,
    quote.vehicle_make_snapshot,
    quote.vehicle_model_snapshot,
  ]
    .filter(Boolean)
    .join(" ");

  return [quote.stock_number_snapshot, vehicleName].filter(Boolean).join(" - ");
}

function getQuoteTotal(quote) {
  const existingTotal = Number(quote.total_price);

  if (Number.isFinite(existingTotal) && existingTotal > 0) {
    return existingTotal;
  }

  return (
    numberOrZero(quote.quantity || 1) * numberOrZero(quote.unit_price) +
    numberOrZero(quote.shipping_cost) +
    numberOrZero(quote.tax_cost)
  );
}

function getQuoteStatusLabel(quote) {
  return quoteStatusLabels[quote.quote_status] ?? "Quoted";
}

function VendorPriceCard({ isSelected = false, onUseQuote, quote }) {
  const vehicleSnapshot = formatVehicleSnapshot(quote);
  const statusLabel = getQuoteStatusLabel(quote);

  return (
    <article
      className={`rounded-2xl border bg-white p-3 shadow-sm transition ${
        isSelected ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h5 className="truncate text-sm font-black text-slate-950">
            {getVendorQuoteDisplayName(quote)}
          </h5>
          <p className="mt-1 truncate text-xs font-semibold text-slate-600">
            {quote.raw_part_name || "Part name unavailable"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ring-inset ${
            quote.quote_status === "purchased"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : quote.quote_status === "rejected" ||
                  quote.quote_status === "unavailable"
                ? "bg-red-50 text-red-700 ring-red-200"
                : "bg-blue-50 text-blue-700 ring-blue-200"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span className="font-black text-slate-950">
          {formatCurrency(quote.unit_price)} each
        </span>
        {quote.quantity && <span>Qty {Number(quote.quantity)}</span>}
        <span>Total {formatCurrency(getQuoteTotal(quote))}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>{availabilityLabels[quote.availability] ?? "Unknown"}</span>
        {vehicleSnapshot && <span>{vehicleSnapshot}</span>}
        <span>{formatDate(quote.quoted_at)}</span>
      </div>

      <div className="mt-3 flex items-center justify-end">
        <button
          className={`min-h-9 rounded-xl px-3 py-1.5 text-xs font-black transition ${
            isSelected
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
              : "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
          }`}
          onClick={() => onUseQuote(quote)}
          type="button"
        >
          {isSelected ? "Selected" : "Use This"}
        </button>
      </div>
    </article>
  );
}

function AddVendorQuoteInline({
  currentProfile,
  onQuoteSaved,
  partName,
  quantity,
  vehicle,
  vendors,
  workOrder,
}) {
  const [formData, setFormData] = useState(initialQuoteForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const hasVendors = vendors.length > 0;

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  async function handleSaveQuote() {
    const normalizedPartName = normalizePartName(partName);
    const hasPrice = String(formData.unit_price ?? "").trim() !== "";
    const unitPrice = Number(formData.unit_price);
    const vendor = vendors.find(
      (vendorRecord) => vendorRecord.id === formData.vendor_id
    );

    if (!normalizedPartName) {
      setErrorMessage("Enter a part name before saving a quote.");
      return;
    }

    if (!vendor) {
      setErrorMessage("Select a vendor before saving a quote.");
      return;
    }

    if (!hasPrice || !Number.isFinite(unitPrice) || unitPrice < 0) {
      setErrorMessage("Enter a valid price.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload = buildVendorPartQuotePayload({
        availability: formData.availability,
        currentProfile,
        notes: formData.notes,
        partName,
        price: {
          quantity,
          unitPrice,
        },
        quoteStatus: "quoted",
        repairJob: workOrder,
        vendor,
        vehicle,
      });
      const { data, error } = await createVendorPartQuote(payload);

      if (error) {
        console.error("Could not save vendor quote:", error);
        setErrorMessage("Could not save vendor quote.");
        return;
      }

      setFormData(initialQuoteForm);
      setSuccessMessage("Quote saved and selected for this part.");
      onQuoteSaved?.({
        ...data,
        display_vendor_name:
          data?.display_vendor_name ??
          data?.vendor_name_snapshot ??
          vendor.name ??
          "Unknown vendor",
        vendor_name: data?.vendor_name_snapshot ?? vendor.name,
      });
    } catch (error) {
      console.error("Could not save vendor quote:", error);
      setErrorMessage("Could not save vendor quote.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!hasVendors) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">
        Add vendors from the Vendors page first.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block" htmlFor="vendor-quote-vendor">
          <span className={formControlClassNames.label}>Vendor</span>
          <select
            className={formControlClassNames.select}
            id="vendor-quote-vendor"
            name="vendor_id"
            onChange={handleChange}
            value={formData.vendor_id}
          >
            <option value="">Select a vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name || "Unnamed Vendor"}
              </option>
            ))}
          </select>
        </label>

        <label className="block" htmlFor="vendor-quote-unit-price">
          <span className={formControlClassNames.label}>Unit Price</span>
          <input
            className={formControlClassNames.input}
            id="vendor-quote-unit-price"
            min="0"
            name="unit_price"
            onChange={handleChange}
            step="0.01"
            type="number"
            value={formData.unit_price}
          />
        </label>

        <label className="block sm:col-span-2" htmlFor="vendor-quote-availability">
          <span className={formControlClassNames.label}>Availability</span>
          <select
            className={formControlClassNames.select}
            id="vendor-quote-availability"
            name="availability"
            onChange={handleChange}
            value={formData.availability}
          >
            {availabilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block" htmlFor="vendor-quote-notes">
        <span className={formControlClassNames.label}>Notes</span>
        <textarea
          className={`${formControlClassNames.textarea} min-h-20`}
          id="vendor-quote-notes"
          name="notes"
          onChange={handleChange}
          value={formData.notes}
        />
      </label>

      <FormMessage tone="error">{errorMessage}</FormMessage>
      <FormMessage tone="success">{successMessage}</FormMessage>

      <div className="flex justify-end">
        <button
          className={`w-full sm:w-auto ${buttonClassNames.secondary}`}
          disabled={isSaving}
          onClick={handleSaveQuote}
          type="button"
        >
          {isSaving ? "Saving quote..." : "Save Quote"}
        </button>
      </div>
    </div>
  );
}

function VendorPriceSuggestions({
  currentProfile,
  onQuoteSaved,
  onUseQuote,
  partName,
  quantity = 1,
  selectedQuote,
  vehicle,
  vendors = [],
  workOrder,
}) {
  const [quotes, setQuotes] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [searchedPartName, setSearchedPartName] = useState("");
  const [isAddQuoteOpen, setIsAddQuoteOpen] = useState(false);
  const searchRequestIdRef = useRef(0);
  const normalizedPartName = normalizePartName(partName);
  const canSearch = normalizedPartName.length >= 2;
  const hasCurrentSearchResults = searchedPartName === normalizedPartName;
  const visibleQuotes = hasCurrentSearchResults ? quotes : [];
  const visibleSearchError = hasCurrentSearchResults ? searchError : "";

  useEffect(() => {
    if (!canSearch) {
      searchRequestIdRef.current += 1;
      return undefined;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      if (!isActive) {
        return;
      }

      setIsSearching(true);
      setSearchError("");

      const { data, error } = await searchVendorPartQuotes({
        limit: 6,
        partName: normalizedPartName,
        vehicle,
      });

      if (!isActive || searchRequestIdRef.current !== requestId) {
        return;
      }

      setQuotes(data ?? []);
      setSearchError(error?.message ?? "");
      setHasSearched(true);
      setSearchedPartName(normalizedPartName);
      setIsSearching(false);
    }, 300);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [canSearch, normalizedPartName, vehicle]);

  function handleQuoteSaved(quote) {
    if (!quote?.id) {
      return;
    }

    setQuotes((currentQuotes) => [
      quote,
      ...currentQuotes.filter((currentQuote) => currentQuote.id !== quote.id),
    ]);
    setHasSearched(true);
    setSearchedPartName(normalizePartName(partName));
    onQuoteSaved?.(quote);
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-black text-slate-950">
            Previous Vendor Prices
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Use a past vendor price or save a quote for next time.
          </p>
        </div>
        <button
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
          onClick={() => setIsAddQuoteOpen((isOpen) => !isOpen)}
          type="button"
        >
          <AppIcon name="plus" size={15} />
          Add Vendor Quote
        </button>
      </div>

      {selectedQuote && (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <span className="font-black">Selected:</span>{" "}
          {getVendorQuoteDisplayName(selectedQuote)} -{" "}
          {formatCurrency(selectedQuote.unit_price)} each
        </div>
      )}

      {isAddQuoteOpen && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
          <AddVendorQuoteInline
            currentProfile={currentProfile}
            onQuoteSaved={handleQuoteSaved}
            partName={partName}
            quantity={quantity}
            vehicle={vehicle}
            vendors={vendors}
            workOrder={workOrder}
          />
        </div>
      )}

      {!canSearch ? (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">
          Enter at least 2 characters to search price history.
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {isSearching && (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-500">
              Searching previous prices...
            </div>
          )}

          {!isSearching && visibleSearchError && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {visibleSearchError}
            </div>
          )}

          {!isSearching &&
            !visibleSearchError &&
            hasSearched &&
            hasCurrentSearchResults &&
            visibleQuotes.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">
                No previous prices found.
              </div>
            )}

          {!isSearching &&
            visibleQuotes.map((quote) => (
              <VendorPriceCard
                isSelected={selectedQuote?.id === quote.id}
                key={quote.id}
                onUseQuote={onUseQuote}
                quote={quote}
              />
            ))}
        </div>
      )}
    </section>
  );
}

export default VendorPriceSuggestions;
