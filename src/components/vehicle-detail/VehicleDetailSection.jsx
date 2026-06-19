import { useState } from "react";
import AppIcon from "../ui/AppIcon";

const toneClassNames = {
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  red: "bg-red-50 text-red-700 ring-red-100",
  slate: "bg-slate-50 text-slate-600 ring-slate-100",
};

function VehicleDetailSection({
  badge,
  children,
  defaultOpen = false,
  icon = "check",
  summary,
  title,
  tone = "slate",
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const toneClassName = toneClassNames[tone] ?? toneClassNames.slate;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${toneClassName}`}
          >
            <AppIcon name={icon} size={19} />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-black text-slate-950">
              {title}
            </span>
            {summary && (
              <span className="block truncate text-sm text-slate-500">
                {summary}
              </span>
            )}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {badge && (
            <span className="max-w-[8.5rem] truncate rounded-full bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 sm:max-w-none">
              {badge}
            </span>
          )}
          <AppIcon
            className={`text-slate-500 transition ${isOpen ? "rotate-90" : ""}`}
            name="chevron-right"
            size={20}
          />
        </span>
      </button>

      {isOpen && <div className="border-t border-slate-100 p-4">{children}</div>}
    </section>
  );
}

export default VehicleDetailSection;
