import {
  formatVehicleStatus,
  getVehicleStatusClassName,
} from "../lib/vehicleStatus";

function VehicleStatusBadge({ className = "", status }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${getVehicleStatusClassName(
        status
      )} ${className}`}
    >
      {formatVehicleStatus(status)}
    </span>
  );
}

export default VehicleStatusBadge;
