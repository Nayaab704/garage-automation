import AppIcon from "./AppIcon";

function StatChip({ className = "", icon, label, value }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200 ${className}`}
    >
      {icon && <AppIcon className="h-3.5 w-3.5" name={icon} size={14} />}
      <span>{label}</span>
      <span className="text-zinc-950">{value}</span>
    </span>
  );
}

export default StatChip;
