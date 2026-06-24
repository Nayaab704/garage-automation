import AppIcon from "./ui/AppIcon";

function ReturnToVehicleBanner({ context, onReturn }) {
  if (!context?.vehicleId) {
    return null;
  }

  const label = context.stockNumber || context.label || "current vehicle";
  const detailLabel =
    context.label && context.label !== label ? context.label : null;

  return (
    <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            Current Vehicle
          </p>
          <p className="truncate text-sm font-semibold text-slate-800">
            {detailLabel ?? label}
          </p>
        </div>

        <button
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700"
          onClick={() => onReturn?.(context)}
          type="button"
        >
          <AppIcon name="car" size={17} />
          <span>Return to Vehicle</span>
        </button>
      </div>
    </div>
  );
}

export default ReturnToVehicleBanner;
