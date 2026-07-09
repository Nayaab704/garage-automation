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

function OperationalSearchBar({
  activeFilterCount = 0,
  children,
  className = "",
  id,
  label = "Search records",
  onChange,
  onClear,
  placeholder,
  resultCount,
  totalCount,
  value,
}) {
  const hasSearch = String(value ?? "").trim().length > 0;
  const hasFilters = activeFilterCount > 0;
  const canClear = hasSearch || hasFilters;
  const resultSummary = getResultSummary(resultCount, totalCount);

  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-slate-50/80 p-3 shadow-inner sm:p-4 ${className}`}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <label className="relative block" htmlFor={id}>
          <span className="sr-only">{label}</span>
          <AppIcon
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            name="search"
            size={18}
          />
          <input
            className="h-[3.25rem] min-h-12 w-full rounded-2xl border border-slate-200 bg-white py-2 pl-11 pr-4 text-sm font-semibold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
            id={id}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            type="search"
            value={value}
          />
        </label>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          {resultSummary && (
            <div className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-wide text-slate-500 shadow-sm">
              {resultSummary}
            </div>
          )}

          {canClear && onClear && (
            <button
              className={buttonClassNames.secondary}
              onClick={onClear}
              type="button"
            >
              Clear Search
            </button>
          )}
        </div>
      </div>

      {children && (
        <div className="mt-3 flex flex-wrap items-end gap-3">{children}</div>
      )}
    </div>
  );
}

export default OperationalSearchBar;
