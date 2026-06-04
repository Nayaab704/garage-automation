export const appShellClassName =
  "relative isolate min-h-screen overflow-x-hidden bg-slate-50";

export const appBackgroundLayerClassName =
  "pointer-events-none fixed inset-0 z-0";

export const pageContainerClassName = "mx-auto max-w-7xl";

export const cardClassNames = {
  base: "rounded-2xl border border-slate-200 bg-white shadow-sm",
  elevated: "rounded-3xl border border-slate-200 bg-white shadow-sm",
  subtle: "rounded-2xl border border-slate-200 bg-white/90 shadow-sm",
};

export const buttonClassNames = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-400",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60",
  danger:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-slate-300",
  icon:
    "inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60",
};

export const formControlClassNames = {
  input:
    "mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100",
  label: "text-sm font-bold text-slate-700",
  select:
    "mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100",
  textarea:
    "mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100",
};

export const badgeClassNames = {
  neutral:
    "inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200",
  success:
    "inline-flex w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200",
  warning:
    "inline-flex w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200",
  danger:
    "inline-flex w-fit rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200",
};
