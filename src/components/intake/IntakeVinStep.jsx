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
    <section className="mx-auto w-full max-w-2xl rounded-[2rem] border border-white/80 bg-white/95 px-4 py-5 text-center shadow-[0_24px_70px_rgba(15,23,42,0.18),0_0_0_1px_rgba(255,255,255,0.75)_inset] backdrop-blur-sm sm:rounded-[2.25rem] sm:px-9 sm:py-8">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-50 via-white to-blue-100 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_16px_32px_rgba(37,99,235,0.18)] ring-1 ring-blue-200/80 sm:h-20 sm:w-20 sm:rounded-[1.75rem]">
        <AppIcon name="car" size={32} />
      </div>

      <p className="mt-4 text-[0.68rem] font-black uppercase tracking-[0.22em] text-blue-700">
        Vehicle Intake
      </p>
      <h2 className="mt-1 text-3xl font-black text-slate-950 sm:text-5xl">
        New Vehicle
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500 sm:text-base">
        Start by entering the 17-character VIN.
      </p>

      <form className="mt-5 space-y-4 text-left sm:mt-7" onSubmit={onSubmit}>
        <label className="block" htmlFor="intake-vin">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            VIN
          </span>
          <span className="relative mt-2 block">
            <span className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 text-blue-700 sm:left-5">
              <AppIcon name="scan" size={26} />
            </span>
            <input
              autoComplete="off"
              className="h-14 w-full rounded-2xl border border-blue-200/80 bg-white/95 pl-14 pr-4 font-mono text-base font-black uppercase tracking-[0.18em] text-slate-950 shadow-[0_0_0_4px_rgba(37,99,235,0.06),0_14px_32px_rgba(15,23,42,0.1)] outline-none transition placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-200/70 sm:h-16 sm:pl-16 sm:text-lg"
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
          className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500 px-5 text-sm font-black text-white shadow-[0_18px_42px_rgba(37,99,235,0.34)] transition hover:-translate-y-0.5 hover:from-blue-800 hover:via-blue-700 hover:to-sky-600 focus:outline-none focus:ring-4 focus:ring-blue-200 active:translate-y-0 disabled:cursor-not-allowed disabled:from-slate-400 disabled:via-slate-400 disabled:to-slate-400 disabled:shadow-none sm:h-16 sm:text-base"
          disabled={isCheckingVin || !canCreateVehicle}
          type="submit"
        >
          {isCheckingVin ? "Checking VIN..." : "Continue to Vehicle Form"}
          {!isCheckingVin && <AppIcon name="chevron-right" size={24} />}
        </button>

        <div className="flex items-center gap-3 pt-1 text-center">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-slate-200" />
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm sm:px-4">
            <AppIcon name="scan" size={18} />
            VIN scan coming soon
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-slate-200 via-slate-200 to-transparent" />
        </div>
      </form>
    </section>
  );
}

export default IntakeVinStep;
