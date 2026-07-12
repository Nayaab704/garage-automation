function VehicleSoldBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex h-7 max-w-full items-center rounded-full bg-slate-950 px-2.5 py-1 text-xs font-semibold leading-none text-white ring-1 ring-inset ring-slate-950 ${className}`}
      title="Sold"
    >
      <span className="min-w-0 truncate">Sold</span>
    </span>
  );
}

export default VehicleSoldBadge;
