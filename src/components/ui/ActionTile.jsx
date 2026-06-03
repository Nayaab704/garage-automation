import AppIcon from "./AppIcon";

const variantClassNames = {
  primary: "border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800",
  secondary:
    "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50",
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
      className={`flex min-h-12 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        variantClassNames[variant] ?? variantClassNames.secondary
      } ${className}`}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {icon && <AppIcon className="h-4 w-4" name={icon} size={16} />}
      <span>{label}</span>
    </button>
  );
}

export default ActionTile;
