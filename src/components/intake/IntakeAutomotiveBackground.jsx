import vehicleIntakeBackground from "../../assets/vehicle-intake-bg.png";

function IntakeAutomotiveBackground() {
  const sideLight = {
    background:
      "linear-gradient(90deg, rgba(248, 250, 252, 0.72) 0%, rgba(248, 250, 252, 0.5) 48%, rgba(248, 250, 252, 0.34) 100%)",
  };
  const floorLight = {
    background:
      "linear-gradient(0deg, rgba(248, 250, 252, 0.96) 0%, rgba(248, 250, 252, 0.7) 52%, rgba(248, 250, 252, 0) 100%)",
  };

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-slate-100"
      data-intake-automotive-background="true"
    >
      <img
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        draggable="false"
        src={vehicleIntakeBackground}
      />
      <div className="absolute inset-0 bg-white/35 sm:bg-white/25" />
      <div className="absolute inset-0" style={sideLight} />
      <div className="absolute inset-x-0 bottom-0 h-2/3" style={floorLight} />
    </div>
  );
}

export default IntakeAutomotiveBackground;
