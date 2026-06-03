import AppIcon from "./ui/AppIcon";
import VehicleStatusBadge from "./VehicleStatusBadge";

const numberFormatter = new Intl.NumberFormat("en-US");

const colorMap = {
  beige: "#d6c6a8",
  black: "#111827",
  blue: "#2563eb",
  brown: "#7c2d12",
  gold: "#d97706",
  gray: "#d1d5db",
  green: "#059669",
  grey: "#d1d5db",
  orange: "#ea580c",
  purple: "#7c3aed",
  red: "#dc2626",
  silver: "#cbd5e1",
  white: "#ffffff",
  yellow: "#facc15",
};

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "Not available";
  }

  return numberFormatter.format(numberValue);
}

function getVehicleTitle(vehicle) {
  const title = [vehicle.year, vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(" ");

  return title || "Vehicle";
}

function hasDisplayValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function getColorDotStyle(color) {
  const normalizedColor = String(color ?? "").trim().toLowerCase();

  return {
    backgroundColor: colorMap[normalizedColor] ?? normalizedColor,
  };
}

function VehicleThumbnail({ photo, title }) {
  if (photo?.photo_url) {
    return (
      <img
        alt={title}
        className="h-20 w-24 rounded-2xl object-cover sm:h-24 sm:w-32"
        src={photo.photo_url}
      />
    );
  }

  return (
    <div className="flex h-20 w-24 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 sm:h-24 sm:w-32">
      <AppIcon name="car" size={36} />
    </div>
  );
}

function VehicleCard({ onSelectVehicle, photo, vehicle }) {
  const title = getVehicleTitle(vehicle);
  const mileageLabel = hasDisplayValue(vehicle.mileage)
    ? `${formatNumber(vehicle.mileage)} mi`
    : "Mileage n/a";
  const colorLabel = vehicle.color || "Color n/a";

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      <button
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
        disabled={!vehicle.id}
        onClick={() => onSelectVehicle?.(vehicle.id)}
        type="button"
      >
        <div className="flex gap-3 p-3 sm:gap-4">
          <VehicleThumbnail photo={photo} title={title} />

          <div className="min-w-0 flex-1">
            <p className="truncate whitespace-nowrap text-base font-black leading-tight text-slate-950 sm:text-lg">
              {displayValue(vehicle.stock_number)}
            </p>
            <p className="mt-1 truncate text-sm font-medium text-slate-800 sm:text-base">
              {title}
              {vehicle.trim ? ` ${vehicle.trim}` : ""}
            </p>

            <div className="mt-2">
              <VehicleStatusBadge
                className="max-w-full truncate px-2.5 text-xs"
                status={vehicle.status}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <AppIcon className="text-slate-400" name="mileage" size={15} />
                {mileageLabel}
              </span>
              <span className="text-slate-300">|</span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                {vehicle.color && (
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-slate-200 shadow-inner"
                    style={getColorDotStyle(vehicle.color)}
                  />
                )}
                <span className="truncate">{colorLabel}</span>
              </span>
            </div>
          </div>

          <span className="mt-1 inline-flex h-10 min-w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white px-3 text-sm font-black text-emerald-700 shadow-sm transition hover:bg-emerald-50 sm:min-w-24 sm:px-5">
            Open
          </span>
        </div>
      </button>
    </article>
  );
}

export default VehicleCard;
