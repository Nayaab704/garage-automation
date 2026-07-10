import { getVehicleColorDisplay } from "../lib/vehicleColorDisplay";

function VehicleColorLabel({
  className = "",
  color,
  colorHex = "",
  label = "Color",
  showLabel = false,
}) {
  const colorDisplay = getVehicleColorDisplay(color, colorHex);
  const title = showLabel
    ? `${label}: ${colorDisplay.label}`
    : colorDisplay.label;

  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}
      title={title}
    >
      {showLabel && (
        <span className="shrink-0 font-semibold text-slate-500">
          {label}:
        </span>
      )}
      <span
        aria-hidden="true"
        className="h-3 w-3 shrink-0 rounded-full border shadow-inner"
        style={colorDisplay.dotStyle}
      />
      <span
        className="min-w-0 truncate font-semibold"
        style={colorDisplay.textStyle}
      >
        {colorDisplay.label}
      </span>
    </span>
  );
}

export default VehicleColorLabel;
