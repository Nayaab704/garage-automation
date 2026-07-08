import { useState } from "react";
import {
  formatVehicleStatus,
  getVehicleStatusClassName,
  normalizeVehicleStatus,
  vehicleStatusOptions,
} from "../../lib/vehicleStatus";

function VehicleStatusDropdown({ currentStatus, isUpdating, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedCurrentStatus = normalizeVehicleStatus(currentStatus);

  async function handleStatusChange(newStatus) {
    setIsOpen(false);

    if (newStatus === normalizedCurrentStatus || isUpdating) {
      return;
    }

    await onChange(newStatus);
  }

  return (
    <div className="relative inline-flex">
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={`inline-flex h-7 max-w-[10.5rem] shrink-0 items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap ring-1 ring-inset transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${getVehicleStatusClassName(
          normalizedCurrentStatus
        )}`}
        disabled={isUpdating}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span className="min-w-0 truncate">
          {formatVehicleStatus(normalizedCurrentStatus)}
        </span>
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
              {status === normalizedCurrentStatus && (
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
