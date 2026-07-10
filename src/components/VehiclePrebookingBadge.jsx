import AppIcon from "./ui/AppIcon";
import { getPrebookingBadgeLabel } from "../lib/vehiclePrebookings";

function VehiclePrebookingBadge({
  className = "",
  interactive = false,
  onClick,
  prebooking,
  showAmount = true,
  showIcon = true,
}) {
  if (!prebooking) {
    return null;
  }

  const label = showAmount ? getPrebookingBadgeLabel(prebooking) : "Prebooked";
  const gapClassName = showIcon ? "gap-1.5" : "";
  const classNames = `inline-flex h-7 max-w-full items-center ${gapClassName} rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold leading-none text-indigo-700 ${className}`;

  if (interactive) {
    return (
      <button
        className={`${classNames} transition hover:border-indigo-300 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-100`}
        onClick={onClick}
        title="Open prebooking details"
        type="button"
      >
        {showIcon && <AppIcon name="dollar" size={14} />}
        <span className="min-w-0 truncate">{label}</span>
      </button>
    );
  }

  return (
    <span className={classNames} title={label}>
      {showIcon && <AppIcon name="dollar" size={14} />}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

export default VehiclePrebookingBadge;
