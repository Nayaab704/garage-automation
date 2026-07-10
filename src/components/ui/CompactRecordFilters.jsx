import { useMemo, useRef, useState } from "react";
import useDismissableLayer from "../../hooks/useDismissableLayer";
import { matchesSearchText } from "../../lib/searchText";
import AppIcon from "./AppIcon";

function getFilteredOptions(options, searchTerm) {
  if (!String(searchTerm ?? "").trim()) {
    return options;
  }

  return options.filter((option) =>
    matchesSearchText(option.searchText || option.label, searchTerm)
  );
}

function FilterDropdown({
  emptyMessage,
  label,
  onChange,
  options = [],
  placeholder,
  searchPlaceholder,
  selectedOption,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const filteredOptions = useMemo(
    () => getFilteredOptions(options, searchTerm),
    [options, searchTerm]
  );
  const recentOptions = filteredOptions.filter((option) => option.isRecent);
  const allOptions = filteredOptions.filter((option) => !option.isRecent);

  useDismissableLayer({
    enabled: isOpen,
    onDismiss: () => setIsOpen(false),
    refs: [dropdownRef],
  });

  function handleSelect(optionId) {
    onChange(optionId);
    setIsOpen(false);
    setSearchTerm("");
  }

  function renderVehicleDot(option) {
    return (
      <span
        aria-hidden="true"
        className="h-3 w-3 shrink-0 rounded-full border border-slate-300"
        style={option.colorDotStyle}
      />
    );
  }

  function renderSelectedMarker() {
    if (selectedOption?.kind === "vehicle") {
      return renderVehicleDot(selectedOption);
    }

    return <AppIcon name="filter" size={14} />;
  }

  function renderOption(option) {
    if (option.kind === "vehicle") {
      return (
        <button
          className="flex w-full min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
          key={option.id}
          onClick={() => handleSelect(option.id)}
          style={option.colorTintStyle}
          title={option.label}
          type="button"
        >
          {renderVehicleDot(option)}
          <span className="min-w-0 truncate text-sm font-black text-slate-800">
            {option.label}
          </span>
        </button>
      );
    }

    return (
      <button
        className="flex w-full min-w-0 items-start gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
        key={option.id}
        onClick={() => handleSelect(option.id)}
        type="button"
      >
        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-slate-800">
            {option.label}
          </span>
          {option.description && (
            <span className="block truncate text-xs font-semibold text-slate-500">
              {option.description}
            </span>
          )}
        </span>
      </button>
    );
  }

  function renderOptionsSection(title, sectionOptions) {
    if (sectionOptions.length === 0) {
      return null;
    }

    return (
      <div>
        <p className="px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-400">
          {title}
        </p>
        <div className="space-y-1">{sectionOptions.map(renderOption)}</div>
      </div>
    );
  }

  return (
    <div className="relative shrink-0 overflow-visible" ref={dropdownRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={`inline-flex min-h-8 max-w-[14rem] items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-black shadow-sm transition focus:outline-none focus:ring-2 focus:ring-slate-200 ${
          selectedOption
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        {renderSelectedMarker()}
        <span className="truncate">
          {selectedOption?.shortLabel || selectedOption?.label || label}
        </span>
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rotate-45 border-b border-r border-current"
        />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl sm:w-80"
          role="menu"
        >
          <div className="p-1">
            <input
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
              type="search"
              value={searchTerm}
            />
          </div>

          {selectedOption && (
            <button
              className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              onClick={() => handleSelect("")}
              type="button"
            >
              <span>{placeholder}</span>
              <span className="text-xs text-slate-400">Clear</span>
            </button>
          )}

          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
            {renderOptionsSection("Recent", recentOptions)}
            {renderOptionsSection(
              recentOptions.length > 0 ? "All" : "Options",
              allOptions
            )}
            {filteredOptions.length === 0 && (
              <p className="px-3 py-4 text-sm font-semibold text-slate-500">
                {emptyMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CompactRecordFilters({
  onVendorChange,
  onVehicleChange,
  selectedVehicleId = "",
  selectedVendorId = "",
  vehicleOptions = [],
  vendorOptions = [],
}) {
  const selectedVendor = vendorOptions.find(
    (option) => option.id === selectedVendorId
  );
  const selectedVehicle = vehicleOptions.find(
    (option) => option.id === selectedVehicleId
  );

  return (
    <div className="relative z-20 flex max-w-full flex-wrap gap-2 overflow-visible pb-1">
      <FilterDropdown
        emptyMessage="No vendors found."
        label="Vendor"
        onChange={onVendorChange}
        options={vendorOptions}
        placeholder="All vendors"
        searchPlaceholder="Search vendors..."
        selectedOption={selectedVendor}
      />
      <FilterDropdown
        emptyMessage="No vehicles found."
        label="Vehicle"
        onChange={onVehicleChange}
        options={vehicleOptions}
        placeholder="All vehicles"
        searchPlaceholder="Search vehicles..."
        selectedOption={selectedVehicle}
      />
    </div>
  );
}

export default CompactRecordFilters;
