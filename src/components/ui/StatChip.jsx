import AppIcon from "./AppIcon";

function StatChip({ className = "", icon, label, value }) {
  return (
    <span
      className={`inline-flex min-h-10 items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-100 ${className}`}
    >
      {icon && <AppIcon className="h-4 w-4 text-slate-500" name={icon} size={16} />}
      <span>{label}</span>
      <span className="text-sm font-black tabular-nums text-slate-950">
        {value}
      </span>
    </span>
  );
}

export default StatChip;
