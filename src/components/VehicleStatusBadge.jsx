import StatusBadge from "./ui/StatusBadge";

function VehicleStatusBadge({ className = "", status }) {
  return <StatusBadge className={`px-3 text-sm ${className}`} status={status} />;
}

export default VehicleStatusBadge;
