import VehicleSoldBadge from "./VehicleSoldBadge";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

function hasDisplayValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function formatCurrency(value) {
  if (!hasDisplayValue(value)) {
    return "";
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? currencyFormatter.format(numberValue) : "";
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getSalePrice(sale) {
  return sale?.sale_price ?? sale?.sold_price ?? null;
}

function getSaleDate(sale) {
  return sale?.sale_date ?? sale?.sold_date ?? sale?.sold_at ?? sale?.created_at;
}

function VehicleSaleSummary({
  canViewDetails = false,
  className = "",
  compact = false,
  sale,
}) {
  if (!sale && !canViewDetails) {
    return <VehicleSoldBadge className={className} />;
  }

  const price = formatCurrency(getSalePrice(sale));
  const date = formatDate(getSaleDate(sale));
  const buyer = sale?.buyer_name ?? sale?.customer_name ?? "";
  const paymentMethod = sale?.payment_method ?? "";
  const detailItems = canViewDetails
    ? [price, date, buyer, paymentMethod].filter(Boolean)
    : [];

  if (compact) {
    return (
      <span
        className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 ${className}`}
      >
        <VehicleSoldBadge />
        {detailItems.length > 0 && (
          <span className="min-w-0 truncate tabular-nums">
            {detailItems.slice(0, 2).join(" · ")}
          </span>
        )}
      </span>
    );
  }

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <VehicleSoldBadge />
            {canViewDetails && price && (
              <span className="text-sm font-black tabular-nums text-slate-950">
                {price}
              </span>
            )}
            {canViewDetails && date && (
              <span className="text-sm font-semibold text-slate-500">
                {date}
              </span>
            )}
          </div>
          {canViewDetails && (buyer || paymentMethod) && (
            <p className="mt-1 truncate text-xs font-semibold text-slate-500">
              {[buyer, paymentMethod].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default VehicleSaleSummary;
