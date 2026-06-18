import { useEffect, useState } from "react";
import {
  getVendorQuoteDisplayName,
  searchVendorPartQuotes,
} from "../../lib/vendorPriceMemory";
import AppIcon from "../ui/AppIcon";
import ModalShell from "../ui/ModalShell";

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

function PartPriceHistoryModal({ onClose, part }) {
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [quotes, setQuotes] = useState([]);

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
        setErrorMessage(error.message);
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
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
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
          {quotes.map((quote) => (
            <article
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              key={quote.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-slate-950">
                    {getVendorQuoteDisplayName(quote)}
                  </h4>
                  <p className="mt-1 text-sm text-slate-500">
                    {quote.raw_part_name || "Unnamed part"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-inset ring-slate-200">
                  {formatStatus(quote.quote_status)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
                <span className="font-black text-slate-950">
                  {formatCurrency(quote.unit_price)} each
                </span>
                <span>Qty {Number(quote.quantity ?? 1)}</span>
                {quote.total_price !== null && quote.total_price !== undefined && (
                  <span>Total {formatCurrency(quote.total_price)}</span>
                )}
                <span>{formatStatus(quote.availability)}</span>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-400">
                {[
                  quote.stock_number_snapshot,
                  [quote.vehicle_year_snapshot, quote.vehicle_make_snapshot, quote.vehicle_model_snapshot]
                    .filter(Boolean)
                    .join(" "),
                  formatDate(quote.quoted_at),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </article>
          ))}
        </div>
      )}
    </ModalShell>
  );
}

export default PartPriceHistoryModal;
