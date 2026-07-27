import { formControlClassNames } from "../ui/uiStyles";
import {
  MAX_WARRANTY_MONTHS,
  MIN_WARRANTY_MONTHS,
  formatWarrantyDate,
  normalizeWarrantyMonths,
} from "../../lib/warranty";

function WarrantyPeriodFields({
  endDate,
  idPrefix = "warranty",
  months,
  notes,
  onMonthsChange,
  onNotesChange,
  onStartDateChange,
  onTypeChange,
  startDate,
  type,
}) {
  const normalizedMonths = normalizeWarrantyMonths(months);

  function changeMonthCount(nextValue) {
    onMonthsChange(normalizeWarrantyMonths(nextValue));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block" htmlFor={`${idPrefix}-start-date`}>
          <span className={formControlClassNames.label}>
            Warranty Start Date
          </span>
          <input
            className={formControlClassNames.input}
            id={`${idPrefix}-start-date`}
            name="warranty_start_date"
            onChange={(event) => onStartDateChange(event.target.value)}
            required
            type="date"
            value={startDate}
          />
        </label>

        <div>
          <label
            className={formControlClassNames.label}
            htmlFor={`${idPrefix}-months`}
          >
            Warranty Period
          </label>
          <div className="mt-2 grid grid-cols-[3rem_minmax(0,1fr)_3rem] gap-2">
            <button
              aria-label="Reduce warranty by one month"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xl font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={normalizedMonths <= MIN_WARRANTY_MONTHS}
              onClick={() => changeMonthCount(normalizedMonths - 1)}
              type="button"
            >
              −
            </button>
            <select
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-center font-bold text-slate-950 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              id={`${idPrefix}-months`}
              name="warranty_months"
              onChange={(event) => changeMonthCount(event.target.value)}
              value={normalizedMonths}
            >
              {Array.from(
                {
                  length:
                    MAX_WARRANTY_MONTHS - MIN_WARRANTY_MONTHS + 1,
                },
                (_, index) => index + MIN_WARRANTY_MONTHS
              ).map((monthCount) => (
                <option key={monthCount} value={monthCount}>
                  {monthCount} {monthCount === 1 ? "month" : "months"}
                </option>
              ))}
            </select>
            <button
              aria-label="Extend warranty by one month"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xl font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={normalizedMonths >= MAX_WARRANTY_MONTHS}
              onClick={() => changeMonthCount(normalizedMonths + 1)}
              type="button"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div
        aria-live="polite"
        className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3"
      >
        <input name="warranty_end_date" type="hidden" value={endDate} />
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
          Calculated Warranty End Date
        </p>
        <p className="mt-1 text-base font-black text-blue-950">
          {formatWarrantyDate(endDate)}
        </p>
        {endDate && (
          <p className="mt-0.5 text-xs font-semibold tabular-nums text-blue-700">
            {endDate}
          </p>
        )}
      </div>

      <label className="block" htmlFor={`${idPrefix}-type`}>
        <span className={formControlClassNames.label}>
          Warranty Type <span className="font-medium text-slate-400">(optional)</span>
        </span>
        <input
          className={formControlClassNames.input}
          id={`${idPrefix}-type`}
          name="warranty_type"
          onChange={(event) => onTypeChange(event.target.value)}
          placeholder="Limited powertrain, dealer warranty..."
          type="text"
          value={type}
        />
      </label>

      <label className="block" htmlFor={`${idPrefix}-notes`}>
        <span className={formControlClassNames.label}>
          Warranty Notes <span className="font-medium text-slate-400">(optional)</span>
        </span>
        <textarea
          className={formControlClassNames.textarea}
          id={`${idPrefix}-notes`}
          name="warranty_notes"
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Coverage, exclusions, or extension notes"
          value={notes}
        />
      </label>
    </div>
  );
}

export default WarrantyPeriodFields;
