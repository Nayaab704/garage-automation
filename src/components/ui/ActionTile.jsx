import AppIcon from "./AppIcon";

const variantClassNames = {
  primary:
    "border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200 hover:bg-blue-100",
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
      className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
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
