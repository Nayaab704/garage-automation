import VehicleOriginBadge from "../VehicleOriginBadge";
import VehicleStatusBadge from "../VehicleStatusBadge";
import VehicleStatusDropdown from "./VehicleStatusDropdown";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US");

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

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

function formatNumber(value) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "Not available";
  }

  return numberFormatter.format(numberValue);
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

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-bold text-zinc-950">
        {value}
      </dd>
    </div>
  );
}

function VehicleHeader({
  canChangeStatus = false,
  canEdit = false,
  canSell = false,
  isSold,
  isStatusUpdating,
  onEdit,
  onSell,
  onStatusChange,
  vehicle,
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
            Overview
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Stock Number
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
                {displayValue(vehicle.stock_number)}
              </h2>
            </div>
            <div className="pb-1">
              <p className="text-xl font-bold text-zinc-900">
                {displayValue(vehicle.year)} {displayValue(vehicle.make)}{" "}
                {displayValue(vehicle.model)}
              </p>
              {vehicle.trim && (
                <p className="mt-1 text-sm text-zinc-500">{vehicle.trim}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {canChangeStatus ? (
              <VehicleStatusDropdown
                currentStatus={vehicle.status}
                isUpdating={isStatusUpdating}
                onChange={onStatusChange}
              />
            ) : (
              <VehicleStatusBadge status={vehicle.status} />
            )}
            <VehicleOriginBadge origin={vehicle.vehicle_origin} />
            {vehicle.color && (
              <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200">
                {vehicle.color}
              </span>
            )}
            <span
              className={`w-fit rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${titleStatusClassName(
                vehicle.title_status
              )}`}
            >
              {formatTitleStatus(vehicle.title_status)}
            </span>
          </div>

          {(canEdit || (canSell && !isSold)) && (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {canEdit && (
                <button
                  className="w-fit rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                  onClick={onEdit}
                  type="button"
                >
                  Edit Vehicle
                </button>
              )}

              {canSell && !isSold && (
                <button
                  className="w-fit rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
                  onClick={onSell}
                  type="button"
                >
                  Sell Vehicle
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DetailItem
          label="VIN"
          value={displayValue(vehicle.vin)}
        />
        <DetailItem
          label="Mileage"
          value={formatNumber(vehicle.mileage)}
        />
        <DetailItem
          label="Purchase Price"
          value={formatCurrency(vehicle.purchase_price)}
        />
        <DetailItem
          label="Target Sale Price"
          value={formatCurrency(vehicle.target_sale_price)}
        />
      </dl>

      {vehicle.notes && (
        <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm font-bold text-zinc-950">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {vehicle.notes}
          </p>
        </div>
      )}
    </section>
  );
}

export default VehicleHeader;
