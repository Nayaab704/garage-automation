import {
  appBackgroundLayerClassName,
  appShellClassName,
} from "./uiStyles";
import { brand } from "../../lib/branding";

function AppBackground({ children, className = "" }) {
  return (
    <div
      className={`${appShellClassName} ${className}`}
      style={{ backgroundColor: brand.colors.surface }}
    >
      <div aria-hidden="true" className={appBackgroundLayerClassName}>
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-transparent to-slate-100/75" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default AppBackground;
