import {
  appBackgroundLayerClassName,
  appShellClassName,
} from "./uiStyles";

function AppBackground({ children, className = "" }) {
  return (
    <div className={`${appShellClassName} ${className}`}>
      <div aria-hidden="true" className={appBackgroundLayerClassName}>
        <div className="absolute -right-28 -top-32 h-80 w-80 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute -bottom-36 -left-28 h-96 w-96 rounded-full bg-slate-200/50 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-transparent to-slate-100/70" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default AppBackground;
