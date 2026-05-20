import VehicleOriginBadge from "./VehicleOriginBadge";
import VehicleStatusBadge from "./VehicleStatusBadge";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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

function formatTitleStatus(status) {
  const labels = {
    clean: "Clean Title",
    salvage: "Salvage",
    rebuilt: "Rebuilt",
    flood: "Flood",
    unknown: "Unknown",
  };

  return labels[status] ?? "Unknown";
}

function titleStatusClassName(status) {
  if (status === "clean") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "salvage" || status === "flood") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "rebuilt") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
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

        <div className="flex flex-wrap justify-end gap-2">
          <VehicleStatusBadge status={vehicle.status} />
          <VehicleOriginBadge origin={vehicle.vehicle_origin} />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {vehicle.make}
          </span>
          {vehicle.title_status && (
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${titleStatusClassName(
                vehicle.title_status
              )}`}
            >
              {formatTitleStatus(vehicle.title_status)}
            </span>
          )}
        </div>
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
