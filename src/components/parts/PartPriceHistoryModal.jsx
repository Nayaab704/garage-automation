import { useEffect, useState } from "react";
import {
  getVendorQuoteDisplayName,
  searchVendorPartQuotes,
} from "../../lib/vendorPriceMemory";
import { selectQuoteForPartRequest } from "../../lib/partsQueue";
import { formatUserFirstName } from "../../lib/userDisplay";
import AppIcon from "../ui/AppIcon";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { buttonClassNames } from "../ui/uiStyles";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

function formatCurrency(value) {
  const numberValue = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(numberValue) ? numberValue : 0);
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(value) {
  if (!value) {
    return "Quoted";
  }

  return String(value)
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeQuoteForSelection(quote) {
  return {
    ...quote,
    id: quote?.id,
    availability: quote?.availability,
    display_vendor_name: quote?.display_vendor_name,
    quote_status: quote?.quote_status,
    raw_part_name: quote?.raw_part_name,
    total_price: quote?.total_price ?? quote?.totalPrice,
    unit_price: quote?.unit_price ?? quote?.unitPrice,
    vendor_id: quote?.vendor_id || quote?.vendorId,
    vendor_name_snapshot:
      quote?.vendor_name_snapshot || quote?.vendorNameSnapshot,
  };
}

function PartPriceHistoryModal({
  onClose,
  onUseQuote,
  part,
  selectedQuoteId = "",
}) {
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [quotes, setQuotes] = useState([]);
  const [selectingQuoteId, setSelectingQuoteId] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadQuotes() {
      setIsLoading(true);
      setErrorMessage("");

      const { data, error } = await searchVendorPartQuotes({
        limit: 8,
        partName: part?.part_name,
        vehicle: part?.vehicle,
      });

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error("Could not load previous vendor prices:", error);
        setErrorMessage("Unable to search previous vendor prices.");
        setQuotes([]);
      } else {
        setQuotes(data ?? []);
      }

      setIsLoading(false);
    }

    loadQuotes();

    return () => {
      isMounted = false;
    };
  }, [part]);

  async function handleUseQuote(quote) {
    if (!onUseQuote || selectingQuoteId) {
      return;
    }

    setSelectingQuoteId(quote.id);
    setErrorMessage("");

    try {
      const normalizedQuote = normalizeQuoteForSelection(quote);

      if (!normalizedQuote.vendor_id) {
        throw new Error("Missing vendor on selected quote.");
      }

      const updatedPart = await selectQuoteForPartRequest({
        partRequestId: part?.id,
        quantity: part?.quantity,
        quote: normalizedQuote,
      });

      await onUseQuote(normalizedQuote, updatedPart);
    } catch (error) {
      console.error("Could not select vendor price:", error);
      setErrorMessage("Could not select this vendor price. Please try again.");
    } finally {
      setSelectingQuoteId("");
    }
  }

  return (
    <ModalShell
      description="Previous quotes and purchases for similar part names."
      onClose={onClose}
      size="lg"
      title="Previous Vendor Prices"
    >
      {isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
          Loading previous prices...
        </div>
      )}

      {!isLoading && errorMessage && (
        <FormMessage tone="error">{errorMessage}</FormMessage>
      )}

      {!isLoading && !errorMessage && quotes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
            <AppIcon name="search" size={20} />
          </div>
          <p className="mt-3 text-sm font-black text-slate-800">
            No previous prices found.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            New saved quotes will show here next time.
          </p>
        </div>
      )}

      {!isLoading && !errorMessage && quotes.length > 0 && (
        <div className="space-y-3">
          {quotes.map((quote) => {
            const normalizedQuote = normalizeQuoteForSelection(quote);
            const hasLinkedVendor = Boolean(normalizedQuote.vendor_id);
            const isSelected = selectedQuoteId === quote.id;
            const isSelecting = selectingQuoteId === quote.id;

            return (
              <article
                className={`rounded-2xl border bg-white p-4 shadow-sm ${
                  isSelected
                    ? "border-blue-300 ring-2 ring-blue-100"
                    : "border-slate-200"
                }`}
                key={quote.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-black text-slate-950">
                      {getVendorQuoteDisplayName(quote)}
                    </h4>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {quote.raw_part_name || "Unnamed part"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {isSelected && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700 ring-1 ring-inset ring-blue-200">
                        Selected
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-inset ring-slate-200">
                      {formatStatus(quote.quote_status)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
                  <span className="font-black text-slate-950">
                    {formatCurrency(quote.unit_price)} each
                  </span>
                  <span>Qty {Number(quote.quantity ?? 1)}</span>
                  {quote.total_price !== null &&
                    quote.total_price !== undefined && (
                      <span>Total {formatCurrency(quote.total_price)}</span>
                    )}
                  <span>{formatStatus(quote.availability)}</span>
                </div>

                <p className="mt-2 text-xs font-semibold text-slate-400">
                  {[
                    quote.stock_number_snapshot,
                    [
                      quote.vehicle_year_snapshot,
                      quote.vehicle_make_snapshot,
                      quote.vehicle_model_snapshot,
                    ]
                      .filter(Boolean)
                      .join(" "),
                    formatDate(quote.quoted_at),
                  ]
                    .filter(Boolean)
                    .join(" - ")}
                </p>

                {quote.createdByProfile && (
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Quote added by{" "}
                    {formatUserFirstName(quote.createdByProfile)} -{" "}
                    {formatDate(quote.created_at ?? quote.quoted_at)}
                  </p>
                )}

                {!hasLinkedVendor && (
                  <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                    This quote has no linked vendor.
                  </p>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    className={
                      isSelected || !hasLinkedVendor
                        ? buttonClassNames.secondary
                        : buttonClassNames.primary
                    }
                    disabled={
                      isSelected || !hasLinkedVendor || Boolean(selectingQuoteId)
                    }
                    onClick={() => handleUseQuote(quote)}
                    type="button"
                  >
                    {isSelected
                      ? "Selected"
                      : isSelecting
                        ? "Selecting..."
                        : "Use This"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

export default PartPriceHistoryModal;
