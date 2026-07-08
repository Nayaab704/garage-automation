import { getVehicleStatusBadge } from "../lib/vehicleStatus";

function VehicleStatusBadge({ className = "", status }) {
  const badge = getVehicleStatusBadge(status);

  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${badge.className} ${className}`}
    >
      {badge.label}
    </span>
  );
}

export default VehicleStatusBadge;
