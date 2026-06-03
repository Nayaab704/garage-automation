import {
  formatHeroBadgeLabel,
  getHeroBadgeClassName,
} from "../../lib/heroBadge";
import AppIcon from "./AppIcon";

function HeroBadge({
  className = "",
  count,
  icon,
  label,
  value,
  variant,
}) {
  const badgeValue = value ?? variant ?? label;
  const badgeLabel = label ?? formatHeroBadgeLabel(badgeValue);
  const classNames = getHeroBadgeClassName(variant ?? badgeValue, className);
  const hasCount = count !== null && count !== undefined && count !== "";

  return (
    <span
      className={classNames}
      title={hasCount ? `${badgeLabel} ${count}` : badgeLabel}
    >
      {icon && (
        <AppIcon className="h-3.5 w-3.5 shrink-0" name={icon} size={14} />
      )}
      <span className="min-w-0 truncate">{badgeLabel}</span>
      {hasCount && (
        <>
          <span aria-hidden="true" className="opacity-60">
            &middot;
          </span>
          <span className="shrink-0">{count}</span>
        </>
      )}
    </span>
  );
}

export default HeroBadge;
