import AppIcon from "./AppIcon";
import { buttonClassNames } from "./uiStyles";

function hasNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function getResultSummary(resultCount, totalCount) {
  if (!hasNumber(resultCount) || !hasNumber(totalCount)) {
    return "";
  }

  const recordLabel = totalCount === 1 ? "record" : "records";

  if (resultCount === totalCount) {
    return `${totalCount} ${recordLabel}`;
  }

  return `${resultCount} of ${totalCount} ${recordLabel}`;
}

export function OperationalSearchIconButton({
  ariaLabel,
  disabled = false,
  icon = "refresh",
  isBusy = false,
  onClick,
  title,
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={buttonClassNames.icon}
      disabled={disabled}
      onClick={onClick}
      title={title ?? ariaLabel}
      type="button"
    >
      <AppIcon
        className={isBusy ? "animate-spin" : ""}
        name={icon}
        size={18}
      />
    </button>
  );
}

function OperationalSearchBar({
  activeFilterCount = 0,
  actions = null,
  children,
  className = "",
  clearLabel = "",
  dense = false,
  id,
  label = "Search records",
  onChange,
  onClear,
  placeholder,
  resultCount,
  showResultSummary = false,
  totalCount,
  value,
}) {
  const hasSearch = String(value ?? "").trim().length > 0;
  const hasFilters = activeFilterCount > 0;
  const canClear = hasSearch || hasFilters;
  const resultSummary = showResultSummary
    ? getResultSummary(resultCount, totalCount)
    : "";
  const hasTools = Boolean(resultSummary) || (canClear && onClear);
  const hasTopControls = Boolean(actions) || hasTools;
  const shellClassName = dense
    ? "rounded-2xl border border-slate-200 bg-slate-50/80 p-2 shadow-inner sm:p-3"
    : "rounded-3xl border border-slate-200 bg-slate-50/80 p-3 shadow-inner sm:p-4";
  const inputClassName = dense
    ? "h-11 min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm font-semibold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
    : "h-[3.25rem] min-h-12 w-full rounded-2xl border border-slate-200 bg-white py-2 pl-11 pr-4 text-sm font-semibold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100";
  const iconClassName = dense
    ? "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
    : "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400";
  const resultChipClassName = dense
    ? "inline-flex min-h-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-black uppercase tracking-wide text-slate-500 shadow-sm"
    : "inline-flex min-h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-wide text-slate-500 shadow-sm";
  const clearButtonClassName = dense
    ? "inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
    : buttonClassNames.secondary;
  const clearButtonLabel = clearLabel || (hasFilters ? "Clear Filters" : "Clear Search");
  const toolsClassName = dense
    ? "flex shrink-0 flex-wrap items-center justify-end gap-2"
    : "flex shrink-0 flex-wrap items-center justify-end gap-2";
  const topRowClassName = hasTopControls
    ? `grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center ${
        dense ? "gap-2" : "gap-3"
      }`
    : `grid min-w-0 ${dense ? "gap-2" : "gap-3"}`;

  return (
    <div className={`${shellClassName} ${className}`}>
      <div className={topRowClassName}>
        <label className="relative block" htmlFor={id}>
          <span className="sr-only">{label}</span>
          <AppIcon
            className={iconClassName}
            name="search"
            size={dense ? 16 : 18}
          />
          <input
            className={inputClassName}
            id={id}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            type="search"
            value={value}
          />
        </label>

        {hasTopControls && (
          <div className={toolsClassName}>
            {actions}

            {resultSummary && (
              <div className={resultChipClassName}>
                {resultSummary}
              </div>
            )}

            {canClear && onClear && (
              <button
                className={clearButtonClassName}
                onClick={onClear}
                type="button"
              >
                {clearButtonLabel}
              </button>
            )}
          </div>
        )}
      </div>

      {children && (
        <div className={`${dense ? "mt-2 gap-2" : "mt-3 gap-3"} flex flex-wrap items-end`}>
          {children}
        </div>
      )}
    </div>
  );
}

export default OperationalSearchBar;
