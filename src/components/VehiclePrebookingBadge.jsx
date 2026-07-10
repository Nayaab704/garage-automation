import AppIcon from "./ui/AppIcon";
import { getPrebookingBadgeLabel } from "../lib/vehiclePrebookings";

function VehiclePrebookingBadge({
  className = "",
  interactive = false,
  onClick,
  prebooking,
}) {
  if (!prebooking) {
    return null;
  }

  const label = getPrebookingBadgeLabel(prebooking);
  const classNames = `inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold leading-none text-indigo-700 ${className}`;

  if (interactive) {
    return (
      <button
        className={`${classNames} transition hover:border-indigo-300 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-100`}
        onClick={onClick}
        title="Open prebooking details"
        type="button"
      >
        <AppIcon name="dollar" size={14} />
        <span className="min-w-0 truncate">{label}</span>
      </button>
    );
  }

  return (
    <span className={classNames} title={label}>
      <AppIcon name="dollar" size={14} />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

export default VehiclePrebookingBadge;
