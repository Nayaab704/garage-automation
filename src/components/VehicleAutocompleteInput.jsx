import { useRef, useState } from "react";
import useDismissableLayer from "../hooks/useDismissableLayer";
import AppIcon from "./ui/AppIcon";
import { formControlClassNames } from "./ui/uiStyles";

function VehicleAutocompleteInput({
  className = "",
  disabled = false,
  id,
  inputClassName = formControlClassNames.input,
  label,
  loading = false,
  name,
  onValueChange,
  placeholder = "",
  required = false,
  suggestions = [],
  value,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const hasSuggestions = suggestions.length > 0;
  const shouldShowMenu = isOpen && !disabled;

  useDismissableLayer({
    enabled: shouldShowMenu,
    onDismiss: () => {
      setIsOpen(false);
      setActiveIndex(-1);
    },
    refs: [containerRef],
  });

  function updateValue(nextValue) {
    onValueChange?.(name, nextValue);
  }

  function handleChange(event) {
    updateValue(event.target.value);
    setIsOpen(true);
    setActiveIndex(-1);
  }

  function selectSuggestion(suggestion) {
    updateValue(suggestion.value);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (!hasSuggestions) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((currentIndex) =>
        currentIndex >= suggestions.length - 1 ? 0 : currentIndex + 1
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((currentIndex) =>
        currentIndex <= 0 ? suggestions.length - 1 : currentIndex - 1
      );
      return;
    }

    if (event.key === "Enter" && isOpen && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    }
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <label className="block" htmlFor={id}>
        <span className={formControlClassNames.label}>{label}</span>
        <div className="relative">
          <input
            aria-autocomplete="list"
            aria-controls={`${id}-suggestions`}
            aria-expanded={shouldShowMenu}
            autoComplete="off"
            className={`${inputClassName} pr-10`}
            disabled={disabled}
            id={id}
            name={name}
            onChange={handleChange}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            required={required}
            role="combobox"
            type="text"
            value={value}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 mt-1 inline-flex -translate-y-1/2 text-slate-400">
            <AppIcon name={loading ? "refresh" : "search"} size={16} />
          </span>
        </div>
      </label>

      {shouldShowMenu && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          id={`${id}-suggestions`}
          role="listbox"
        >
          {hasSuggestions ? (
            <div className="max-h-64 overflow-y-auto py-1">
              {suggestions.map((suggestion, index) => (
                <button
                  aria-selected={index === activeIndex}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-bold transition ${
                    index === activeIndex
                      ? "bg-blue-50 text-blue-900"
                      : "text-slate-800 hover:bg-slate-50"
                  }`}
                  key={suggestion.key}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectSuggestion(suggestion)}
                  role="option"
                  type="button"
                >
                  <span className="min-w-0 truncate">{suggestion.label}</span>
                  <AppIcon
                    className={
                      index === activeIndex ? "text-blue-600" : "text-slate-300"
                    }
                    name="chevron-right"
                    size={15}
                  />
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-2.5 text-sm font-semibold text-slate-500">
              Type a custom value to save it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default VehicleAutocompleteInput;
