const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "Not available";
  }

  return currencyFormatter.format(numberValue);
}

function VehicleCard({ vehicle }) {
  const estimatedProfit = Number(vehicle.estimated_profit);
  const profitClassName =
    Number.isFinite(estimatedProfit) && estimatedProfit < 0
      ? "mt-1 font-semibold text-red-700"
      : "mt-1 font-semibold text-emerald-700";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Stock Number</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            {vehicle.stock_number}
          </h2>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          {vehicle.make}
        </span>
      </div>

      <p className="mt-4 text-lg font-semibold text-slate-800">
        {vehicle.make} {vehicle.model}
      </p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-slate-500">Purchase Price</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {formatCurrency(vehicle.purchase_price)}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-slate-500">Total Invested</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {formatCurrency(vehicle.total_invested)}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-slate-500">Estimated Profit</dt>
          <dd className={profitClassName}>
            {formatCurrency(vehicle.estimated_profit)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export default VehicleCard;
