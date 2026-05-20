import {
  formatVehicleOrigin,
  getVehicleOriginClassName,
} from "../lib/vehicleOrigin";

function VehicleOriginBadge({ className = "", origin }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${getVehicleOriginClassName(
        origin
      )} ${className}`}
    >
      {formatVehicleOrigin(origin)}
    </span>
  );
}

export default VehicleOriginBadge;
