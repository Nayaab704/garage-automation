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
  const classNames = `inline-flex h-7 max-w-full items-center ${gapClassName} rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold leading-none text-violet-700 ${className}`;

  if (interactive) {
    return (
      <button
        className={`${classNames} transition hover:border-violet-300 hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-100`}
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
