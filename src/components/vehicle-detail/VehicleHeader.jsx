import AppIcon from "../ui/AppIcon";
import HeroBadge from "../ui/HeroBadge";
import VehicleStatusBadge from "../VehicleStatusBadge";
import { normalizeVehicleStatus } from "../../lib/vehicleStatus";
import VehicleStatusDropdown from "./VehicleStatusDropdown";

const numberFormatter = new Intl.NumberFormat("en-US");
const readyActionHiddenStatuses = new Set([
  "ready_for_sale",
]);

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
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

function formatMileage(value) {
  const formattedNumber = formatNumber(value);

  return formattedNumber === "Not available"
    ? formattedNumber
    : `${formattedNumber} mi`;
}

function getVehicleTitle(vehicle) {
  const titleParts = [vehicle.year, vehicle.make, vehicle.model].filter(
    Boolean
  );

  return titleParts.length > 0 ? titleParts.join(" ") : "Vehicle Details";
}

function QuickActionButton({ icon, label, onClick, primary = false }) {
  return (
    <button
      className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold shadow-sm transition ${
        primary
          ? "border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200 hover:bg-blue-100"
          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
      }`}
      onClick={onClick}
      type="button"
    >
      <AppIcon name={icon} size={20} />
      <span>{label}</span>
    </button>
  );
}

function CompactActionButton({
  disabled = false,
  icon,
  label,
  onClick,
  tone = "default",
}) {
  const toneClassName =
    tone === "blue"
      ? "border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200 hover:bg-blue-100"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <button
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClassName}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <AppIcon name={icon} size={15} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function getVehicleOrigin(vehicle) {
  return vehicle.vehicle_origin || vehicle.origin || "";
}

function formatHeroOrigin(origin) {
  const labels = {
    auction: "Auction",
    customer_trade_in: "Customer Trade",
    other: "Other",
    personal: "Personal",
    training: "Training",
    unknown: "Unknown Origin",
  };

  return labels[origin] ?? "";
}

function MetadataRow({ vehicle }) {
  const items = [
    { label: "Mileage", value: formatMileage(vehicle.mileage) },
    { label: "Color", value: vehicle.color },
    { label: "VIN", value: vehicle.vin },
  ].filter((item) => item.value && item.value !== "Not available");

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-slate-500 sm:text-sm">
      {items.map((item, index) => (
        <span className="inline-flex min-w-0 items-center gap-2" key={item.label}>
          {index > 0 && (
            <>
              <span aria-hidden="true" className="text-slate-300">
                &middot;
              </span>
            </>
          )}
          <span className={item.label === "VIN" ? "break-all" : ""}>
            <span className="font-semibold text-slate-500">{item.label}:</span>{" "}
            {item.value}
          </span>
        </span>
      ))}
    </div>
  );
}

function VehicleHeader({
  canChangeStatus = false,
  canAddWorkOrder = false,
  canEdit = false,
  canManagePhotos = false,
  canMarkReady = false,
  isStatusUpdating,
  onEdit,
  onMarkReady,
  onQuickAddWorkOrder,
  onQuickPhotos,
  onStatusChange,
  primaryPhoto,
  vehicle,
}) {
  const title = getVehicleTitle(vehicle);
  const stockNumber = displayValue(vehicle.stock_number);
  const thumbnailUrl = primaryPhoto?.photo_url;
  const vehicleOrigin = getVehicleOrigin(vehicle);
  const vehicleOriginLabel = formatHeroOrigin(vehicleOrigin);
  const normalizedVehicleStatus = normalizeVehicleStatus(vehicle.status);
  const shouldShowReadyAction =
    canMarkReady && !readyActionHiddenStatuses.has(normalizedVehicleStatus);

  return (
    <div className="space-y-3">
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="p-3 sm:p-4">
          <div className="flex gap-4">
            <button
              aria-label={
                canManagePhotos
                  ? "Change main vehicle photo"
                  : "View vehicle photos"
              }
              className="group relative h-[72px] w-[92px] shrink-0 overflow-hidden rounded-2xl bg-slate-100 text-left ring-1 ring-inset ring-slate-200 transition hover:ring-blue-200 sm:h-[90px] sm:w-[132px]"
              onClick={onQuickPhotos}
              type="button"
            >
              {thumbnailUrl ? (
                <img
                  alt={`${title} thumbnail`}
                  className="h-full w-full object-cover"
                  src={thumbnailUrl}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
                  <AppIcon name="camera" size={32} />
                  {canManagePhotos && (
                    <span className="text-[11px] font-bold text-slate-500">
                      Main Photo
                    </span>
                  )}
                </div>
              )}
              {canManagePhotos && thumbnailUrl && (
                <span className="absolute inset-x-2 bottom-2 rounded-full bg-slate-950/75 px-2 py-1 text-center text-[11px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                  Change Main
                </span>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-500">
                    {stockNumber}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {canEdit && (
                    <CompactActionButton
                      icon="checklist"
                      label="Edit"
                      onClick={onEdit}
                    />
                  )}
                  {shouldShowReadyAction && (
                    <CompactActionButton
                      disabled={isStatusUpdating}
                      icon="check"
                      label="Ready"
                      onClick={onMarkReady}
                      tone="blue"
                    />
                  )}
                </div>
              </div>

              <h2 className="mt-0.5 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                {title}
              </h2>
              {vehicle.trim && (
                <p className="mt-0.5 text-sm font-medium text-slate-500">
                  {vehicle.trim}
                </p>
              )}

              <div className="mt-2 flex flex-wrap gap-1.5">
                {canChangeStatus ? (
                  <VehicleStatusDropdown
                    currentStatus={vehicle.status}
                    isUpdating={isStatusUpdating}
                    onChange={onStatusChange}
                  />
                ) : (
                  <VehicleStatusBadge
                    className="h-7 max-w-[10.5rem] truncate px-2.5 text-xs"
                    status={vehicle.status}
                  />
                )}
                <HeroBadge value={vehicle.title_status ?? "unknown"} />
                {vehicleOriginLabel && (
                  <HeroBadge
                    label={vehicleOriginLabel}
                    value={vehicleOrigin || "unknown"}
                    variant="gray"
                  />
                )}
              </div>

              <MetadataRow vehicle={vehicle} />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 px-3 py-2.5 sm:px-4">
          <div className="grid gap-2 sm:max-w-sm">
            <QuickActionButton
              icon="plus"
              label={canAddWorkOrder ? "Add Work Order" : "Service Work"}
              onClick={onQuickAddWorkOrder}
              primary
            />
          </div>
        </div>
      </section>

    </div>
  );
}

export default VehicleHeader;
