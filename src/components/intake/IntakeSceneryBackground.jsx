import intakeMountainsImage from "../../assets/backgrounds/intake-mountains.png";

function IntakeSceneryBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 left-1/2 z-[1] h-[44%] min-h-48 max-h-96 w-screen -translate-x-1/2 overflow-hidden"
      data-intake-mountain-background="true"
    >
      <img
        alt=""
        className="absolute inset-0 z-[1] h-full w-full object-cover object-bottom opacity-95"
        draggable="false"
        src={intakeMountainsImage}
      />
      <div className="absolute inset-x-0 top-0 z-[2] h-28 bg-gradient-to-b from-white via-white/65 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 z-[2] h-full bg-gradient-to-t from-emerald-50/10 via-transparent to-white/5" />
    </div>
  );
}

export default IntakeSceneryBackground;
