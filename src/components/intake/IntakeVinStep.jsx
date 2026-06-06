import AppIcon from "../ui/AppIcon";

function IntakeVinStep({
  canCreateVehicle,
  errorMessage,
  isCheckingVin,
  onSubmit,
  onVinChange,
  vin,
}) {
  return (
    <section className="mx-auto mt-1 w-full max-w-3xl rounded-[2rem] border border-white/80 bg-white/95 px-5 py-5 text-center shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur sm:mt-2 sm:px-10 sm:py-8">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 shadow-inner ring-1 ring-emerald-100 sm:h-20 sm:w-20">
        <AppIcon name="car" size={34} />
      </div>

      <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:mt-5 sm:text-4xl">
        New Vehicle
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium text-slate-500 sm:text-base">
        Start by entering the 17-character VIN.
      </p>

      <form className="mt-5 space-y-4 text-left sm:mt-6" onSubmit={onSubmit}>
        <label className="block" htmlFor="intake-vin">
          <span className="text-base font-black text-slate-700">VIN</span>
          <span className="relative mt-3 block">
            <span className="pointer-events-none absolute left-5 top-1/2 flex -translate-y-1/2 text-emerald-700">
              <AppIcon name="scan" size={30} />
            </span>
            <input
              autoComplete="off"
              className="h-14 w-full rounded-2xl border border-emerald-200 bg-white pl-16 pr-4 font-mono text-base font-bold uppercase tracking-wide text-slate-950 shadow-[0_0_0_3px_rgba(16,185,129,0.06),0_10px_24px_rgba(15,23,42,0.08)] outline-none transition placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 sm:h-16 sm:text-lg"
              id="intake-vin"
              inputMode="text"
              maxLength={17}
              onChange={onVinChange}
              placeholder="Enter 17-character VIN"
              type="text"
              value={vin}
            />
          </span>
        </label>

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {errorMessage}
          </div>
        )}

        {!canCreateVehicle && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Your role can view intake, but cannot create vehicles.
          </div>
        )}

        <button
          className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white shadow-[0_16px_34px_rgba(0,122,61,0.28)] transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none sm:h-16 sm:text-base"
          disabled={isCheckingVin || !canCreateVehicle}
          type="submit"
        >
          {isCheckingVin ? "Checking VIN..." : "Continue to Vehicle Form"}
          {!isCheckingVin && <AppIcon name="chevron-right" size={24} />}
        </button>

        <div className="flex items-center gap-4 pt-1 text-center">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-500 shadow-sm">
            <AppIcon name="scan" size={18} />
            VIN scan coming soon
          </span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
      </form>
    </section>
  );
}

export default IntakeVinStep;
