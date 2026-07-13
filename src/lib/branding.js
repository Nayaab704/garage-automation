import logoUrl from "../assets/branding/makkah-autosales-logo.png";
import {
  APP_NAME,
  APP_SHORT_NAME,
  BRAND_COLORS,
  BRAND_TAGLINE,
} from "../config/appConfig";

export const brand = {
  colors: BRAND_COLORS,
  logoAlt: `${APP_NAME} logo`,
  logoUrl,
  name: APP_NAME,
  shortName: APP_SHORT_NAME,
  tagline: BRAND_TAGLINE,
};

export const brandClassNames = {
  iconFrame:
    "shrink-0 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm ring-1 ring-white/70",
  wordmark: "inline-flex min-w-0 items-baseline leading-none tracking-normal",
  wordmarkPrimary:
    "shrink-0 font-black text-slate-950 antialiased [text-wrap:balance]",
  wordmarkSecondary:
    "shrink-0 font-semibold italic text-blue-700 antialiased",
};
