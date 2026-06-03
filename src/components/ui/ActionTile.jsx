import AppIcon from "./AppIcon";

const variantClassNames = {
  primary:
    "border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200 hover:bg-blue-100",
  quick:
    "border-2 border-blue-200 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-50",
  secondary:
    "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
};

function ActionTile({
  className = "",
  disabled = false,
  icon,
  label,
  onClick,
  type = "button",
  variant = "secondary",
}) {
  return (
    <button
      className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${
        variantClassNames[variant] ?? variantClassNames.secondary
      } ${className}`}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {icon && <AppIcon className="h-5 w-5" name={icon} size={20} />}
      <span>{label}</span>
    </button>
  );
}

export default ActionTile;
