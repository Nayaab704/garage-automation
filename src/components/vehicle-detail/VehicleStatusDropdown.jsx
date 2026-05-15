import { useState } from "react";
import {
  formatVehicleStatus,
  getVehicleStatusClassName,
  vehicleStatusOptions,
} from "../../lib/vehicleStatus";

function VehicleStatusDropdown({ currentStatus, isUpdating, onChange }) {
  const [isOpen, setIsOpen] = useState(false);

  async function handleStatusChange(newStatus) {
    setIsOpen(false);

    if (newStatus === currentStatus || isUpdating) {
      return;
    }

    await onChange(newStatus);
  }

  return (
    <div className="relative inline-flex">
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${getVehicleStatusClassName(
          currentStatus
        )}`}
        disabled={isUpdating}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span>{formatVehicleStatus(currentStatus)}</span>
        {isUpdating ? (
          <span className="text-xs font-semibold">Saving</span>
        ) : (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rotate-45 border-b border-r border-current"
          />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-8 z-20 w-52 rounded-md border border-zinc-200 bg-white p-1 shadow-lg"
          role="menu"
        >
          {vehicleStatusOptions.map((status) => (
            <button
              className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
              key={status}
              onClick={() => handleStatusChange(status)}
              role="menuitem"
              type="button"
            >
              <span>{formatVehicleStatus(status)}</span>
              {status === currentStatus && (
                <span className="text-xs font-semibold text-zinc-400">
                  Current
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default VehicleStatusDropdown;
