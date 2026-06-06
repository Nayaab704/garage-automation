import { brand, brandClassNames } from "../../lib/branding";
import BrandWordmark from "./BrandWordmark";

const sizeStyles = {
  compact: {
    frame: "h-10 w-10 rounded-xl",
    image: "h-full w-full object-cover",
    tagline: "text-[11px]",
    gap: "gap-2.5",
  },
  default: {
    frame: "h-12 w-12",
    image: "h-full w-full object-cover",
    tagline: "text-xs",
    gap: "gap-3",
  },
  large: {
    frame: "h-16 w-16 rounded-3xl",
    image: "h-full w-full object-cover",
    tagline: "text-sm",
    gap: "gap-4",
  },
};

function BrandLogo({
  className = "",
  mode = "full",
  showTagline = false,
  size = "default",
}) {
  const styles = sizeStyles[size] ?? sizeStyles.default;
  const showIcon = mode === "full" || mode === "icon";
  const showWordmark = mode === "full" || mode === "wordmark";

  return (
    <div
      aria-label={mode === "icon" ? brand.name : undefined}
      className={`flex min-w-0 items-center ${styles.gap} ${className}`}
    >
      {showIcon && (
        <div className={`${brandClassNames.iconFrame} ${styles.frame}`}>
          <img
            alt={showWordmark ? "" : brand.logoAlt}
            className={styles.image}
            draggable="false"
            src={brand.logoUrl}
          />
        </div>
      )}

      {showWordmark && (
        <div className="min-w-0">
          <BrandWordmark size={size} />
          {showTagline && (
            <p
              className={`mt-1 truncate font-semibold leading-none text-slate-500 ${styles.tagline}`}
            >
              {brand.tagline}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default BrandLogo;
