import { useState } from "react";
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
    <div className="rounded-md bg-zinc-50 px-3 py-2.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-bold text-zinc-950">
        {value}
      </dd>
    </div>
  );
}

function CompactBadge({ children, className }) {
  return (
    <span
      className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
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
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            Overview
          </p>
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Stock Number
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">
              {displayValue(vehicle.stock_number)}
            </h2>
          </div>
          <div className="mt-3 min-w-0">
            <p className="text-xl font-bold text-zinc-900">
              {displayValue(vehicle.year)} {displayValue(vehicle.make)}{" "}
              {displayValue(vehicle.model)}
            </p>
            {vehicle.trim && (
              <p className="mt-1 text-sm text-zinc-500">{vehicle.trim}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {canChangeStatus ? (
              <VehicleStatusDropdown
                currentStatus={vehicle.status}
                isUpdating={isStatusUpdating}
                onChange={onStatusChange}
              />
            ) : (
              <VehicleStatusBadge status={vehicle.status} />
            )}
            {vehicle.color && (
              <CompactBadge className="bg-zinc-100 text-zinc-700 ring-zinc-200">
                {vehicle.color}
              </CompactBadge>
            )}
            <span
              className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${titleStatusClassName(
                vehicle.title_status
              )}`}
            >
              {formatTitleStatus(vehicle.title_status)}
            </span>
          </div>

          {(canEdit || (canSell && !isSold)) && (
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {canEdit && (
                <button
                  className="min-h-10 w-fit rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                  onClick={onEdit}
                  type="button"
                >
                  Edit Vehicle
                </button>
              )}

              {canSell && !isSold && (
                <button
                  className="min-h-10 w-fit rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
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

      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        <DetailItem
          label="VIN"
          value={displayValue(vehicle.vin)}
        />
        <DetailItem
          label="Mileage"
          value={formatNumber(vehicle.mileage)}
        />
      </dl>

      <div className="mt-4 border-t border-zinc-100 pt-3">
        <button
          className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md px-1 text-left text-sm font-bold text-zinc-950 transition hover:bg-zinc-50"
          onClick={() => setIsDetailsOpen((isOpen) => !isOpen)}
          type="button"
        >
          <span>Vehicle Details</span>
          <span className="text-zinc-500">
            {isDetailsOpen ? "Hide" : "Show"}
          </span>
        </button>
      </div>

      {isDetailsOpen && (
        <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3">
          <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <DetailItem
          label="Purchase Price"
          value={formatCurrency(vehicle.purchase_price)}
        />
        <DetailItem
          label="Target Sale Price"
          value={formatCurrency(vehicle.target_sale_price)}
        />
            <div className="rounded-md bg-zinc-50 px-3 py-2.5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Vehicle Origin
              </dt>
              <dd className="mt-2">
                <VehicleOriginBadge origin={vehicle.vehicle_origin} />
              </dd>
            </div>
          </dl>

      {vehicle.notes && (
            <div className="mt-3 rounded-md bg-zinc-50 p-3">
              <p className="text-sm font-bold text-zinc-950">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                {vehicle.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default VehicleHeader;
