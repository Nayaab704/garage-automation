import { brand, brandClassNames } from "../../lib/branding";

const sizeClassNames = {
  compact: {
    gap: "gap-1",
    primary: "text-base",
    secondary: "text-[15px]",
  },
  default: {
    gap: "gap-1.5",
    primary: "text-lg",
    secondary: "text-[17px]",
  },
  large: {
    gap: "gap-2",
    primary: "text-2xl",
    secondary: "text-[23px]",
  },
};

function BrandWordmark({ className = "", size = "default" }) {
  const styles = sizeClassNames[size] ?? sizeClassNames.default;

  return (
    <span
      aria-label={brand.name}
      className={`${brandClassNames.wordmark} ${styles.gap} ${className}`}
    >
      <span className={`${brandClassNames.wordmarkPrimary} ${styles.primary}`}>
        Makkah
      </span>
      <span
        className={`${brandClassNames.wordmarkSecondary} ${styles.secondary}`}
      >
        Autosales
      </span>
    </span>
  );
}

export default BrandWordmark;
