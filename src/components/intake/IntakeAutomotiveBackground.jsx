function IntakeAutomotiveBackground() {
  const premiumAtmosphere = {
    backgroundImage:
      "radial-gradient(circle at 50% 16%, rgba(96, 165, 250, 0.34), transparent 24rem), radial-gradient(circle at 18% 28%, rgba(37, 99, 235, 0.24), transparent 20rem), radial-gradient(circle at 82% 66%, rgba(14, 165, 233, 0.18), transparent 22rem), linear-gradient(145deg, #020617 0%, #0f172a 26%, #1e3a8a 58%, #eff6ff 100%)",
  };
  const blueprintGrid = {
    backgroundImage:
      "linear-gradient(rgba(191, 219, 254, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(191, 219, 254, 0.12) 1px, transparent 1px), linear-gradient(rgba(255, 255, 255, 0.07) 2px, transparent 2px), linear-gradient(90deg, rgba(255, 255, 255, 0.07) 2px, transparent 2px)",
    backgroundPosition: "center",
    backgroundSize: "34px 34px, 34px 34px, 136px 136px, 136px 136px",
  };

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-slate-950"
      data-intake-automotive-background="true"
    >
      <div className="absolute inset-0" style={premiumAtmosphere} />
      <div
        className="absolute inset-0 opacity-95 [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]"
        style={blueprintGrid}
      />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-white via-white/58 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-slate-950/30 via-transparent to-transparent" />

      <div className="absolute left-1/2 top-[42%] h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/20 blur-3xl sm:h-[30rem] sm:w-[30rem]" />
      <div className="absolute -left-20 top-16 h-44 w-44 rounded-full bg-sky-300/20 blur-3xl sm:left-10 sm:h-72 sm:w-72" />
      <div className="absolute -right-24 bottom-28 h-64 w-64 rounded-full bg-blue-900/30 blur-3xl sm:right-6 sm:h-80 sm:w-80" />

      <div className="absolute left-1/2 top-[43%] h-[19rem] w-[19rem] -translate-x-1/2 -translate-y-1/2 rounded-[3.5rem] border border-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] sm:h-[34rem] sm:w-[54rem] sm:rounded-[5rem]" />
      <div className="absolute left-1/2 top-[43%] h-[14rem] w-[14rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-200/15 sm:h-[24rem] sm:w-[24rem]" />

      <svg
        className="absolute bottom-[4.5rem] left-1/2 h-40 w-[32rem] max-w-none -translate-x-1/2 text-white opacity-[0.14] sm:bottom-[-2rem] sm:h-[26rem] sm:w-[54rem] sm:opacity-[0.11]"
        fill="none"
        role="img"
        viewBox="0 0 960 420"
      >
        <path
          d="M92 236C128 196 174 174 252 170H526C618 170 680 194 736 236"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="7"
        />
        <path
          d="M152 236H806"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="7"
        />
        <path
          d="M248 170L310 112H500L582 170"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="5"
        />
        <circle cx="238" cy="252" r="44" stroke="currentColor" strokeWidth="7" />
        <circle cx="682" cy="252" r="44" stroke="currentColor" strokeWidth="7" />
        <path
          d="M126 82H844M158 118H790M188 342H824"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <path
          d="M122 82V354M844 82V354M458 62V374"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <path
          d="M86 354H872"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="5"
        />
      </svg>

      <svg
        className="absolute -left-20 top-20 hidden h-[22rem] w-[30rem] max-w-none text-blue-100 opacity-[0.09] lg:block"
        fill="none"
        role="img"
        viewBox="0 0 520 380"
      >
        <path d="M74 58H430V318H74z" stroke="currentColor" strokeWidth="6" />
        <path
          d="M122 318V124H382V318M122 176H382M122 228H382M252 124V318"
          stroke="currentColor"
          strokeWidth="5"
        />
        <path
          d="M42 318H478"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="7"
        />
      </svg>
    </div>
  );
}

export default IntakeAutomotiveBackground;
