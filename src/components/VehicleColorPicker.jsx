import {
  commonVehicleColorOptions,
  getClosestVehicleColorName,
  getVehicleColorDisplay,
  getVehicleColorHexForName,
  normalizeVehicleColorHex,
  normalizeVehicleColorName,
} from "../lib/vehicleColorDisplay";
import { formControlClassNames } from "./ui/uiStyles";

function isCommonColor(colorName, colorHex) {
  const normalizedName = normalizeVehicleColorName(colorName);
  const normalizedHex = normalizeVehicleColorHex(colorHex);

  return commonVehicleColorOptions.some(
    (option) =>
      normalizeVehicleColorName(option.name) === normalizedName ||
      normalizeVehicleColorHex(option.hex) === normalizedHex
  );
}

function getSelectedCommonColor(colorName, colorHex) {
  const normalizedName = normalizeVehicleColorName(colorName);
  const normalizedHex = normalizeVehicleColorHex(colorHex);

  return commonVehicleColorOptions.find(
    (option) =>
      normalizeVehicleColorName(option.name) === normalizedName ||
      normalizeVehicleColorHex(option.hex) === normalizedHex
  );
}

function VehicleColorPicker({
  className = "",
  colorHex = "",
  colorName = "",
  disabled = false,
  label = "Color",
  onChange,
}) {
  const normalizedHex = normalizeVehicleColorHex(colorHex);
  const selectedCommonColor = getSelectedCommonColor(colorName, normalizedHex);
  const isCustomSelected =
    Boolean(colorName || normalizedHex) && !isCommonColor(colorName, normalizedHex);
  const selectedHex =
    normalizedHex || getVehicleColorHexForName(colorName) || "#64748B";
  const colorDisplay = getVehicleColorDisplay(colorName, selectedHex);

  function emitChange(nextColorName, nextColorHex) {
    onChange?.({
      colorHex: normalizeVehicleColorHex(nextColorHex),
      colorName: nextColorName,
    });
  }

  function handleCommonColorClick(option) {
    emitChange(option.name, option.hex);
  }

  function handleCustomClick() {
    const nextHex = normalizedHex || getVehicleColorHexForName(colorName) || "#64748B";
    const nextName = colorName || getClosestVehicleColorName(nextHex) || "Custom";

    emitChange(nextName, nextHex);
  }

  function handleCustomHexChange(event) {
    const nextHex = normalizeVehicleColorHex(event.target.value);
    const currentClosestName = getClosestVehicleColorName(selectedHex);
    const shouldSuggestName =
      !colorName ||
      normalizeVehicleColorName(colorName) ===
        normalizeVehicleColorName(currentClosestName);
    const nextName = shouldSuggestName
      ? getClosestVehicleColorName(nextHex) || colorName
      : colorName;

    emitChange(nextName, nextHex);
  }

  function handleCustomNameChange(event) {
    emitChange(event.target.value, selectedHex);
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <span className={formControlClassNames.label}>{label}</span>

      <div className="flex flex-wrap gap-2">
        {commonVehicleColorOptions.map((option) => {
          const isSelected =
            selectedCommonColor?.name === option.name && !isCustomSelected;
          const optionDisplay = getVehicleColorDisplay(option.name, option.hex);

          return (
            <button
              aria-pressed={isSelected}
              className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-black transition ${
                isSelected
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              } disabled:cursor-not-allowed disabled:opacity-60`}
              disabled={disabled}
              key={option.name}
              onClick={() => handleCommonColorClick(option)}
              type="button"
            >
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 rounded-full border shadow-inner"
                style={optionDisplay.dotStyle}
              />
              {option.name}
            </button>
          );
        })}

        <button
          aria-pressed={isCustomSelected}
          className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-black transition ${
            isCustomSelected
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          } disabled:cursor-not-allowed disabled:opacity-60`}
          disabled={disabled}
          onClick={handleCustomClick}
          type="button"
        >
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 rounded-full border shadow-inner"
            style={colorDisplay.dotStyle}
          />
          Custom
        </button>
      </div>

      {(colorName || normalizedHex) && (
        <div className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 rounded-full border shadow-inner"
            style={colorDisplay.dotStyle}
          />
          <span className="min-w-0 truncate font-semibold text-slate-500">
            Selected:
          </span>
          <span
            className="min-w-0 truncate font-black"
            style={colorDisplay.textStyle}
          >
            {colorDisplay.label}
          </span>
        </div>
      )}

      {isCustomSelected && (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
          <label className="block" htmlFor="vehicle-custom-color-hex">
            <span className={formControlClassNames.label}>Custom Shade</span>
            <input
              className="mt-2 h-12 w-16 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled}
              id="vehicle-custom-color-hex"
              onChange={handleCustomHexChange}
              type="color"
              value={selectedHex}
            />
          </label>

          <label className="block min-w-0" htmlFor="vehicle-custom-color-name">
            <span className={formControlClassNames.label}>Color Name</span>
            <input
              className={formControlClassNames.input}
              disabled={disabled}
              id="vehicle-custom-color-name"
              onChange={handleCustomNameChange}
              placeholder="Violet"
              type="text"
              value={colorName}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export default VehicleColorPicker;
