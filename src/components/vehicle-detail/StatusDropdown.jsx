import { useRef, useState } from "react";
import useDismissableLayer from "../../hooks/useDismissableLayer";

function formatStatusLabel(status) {
  if (!status) {
    return "Not Available";
  }

  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getStatusClassName(status) {
  const normalizedStatus = String(status ?? "").toLowerCase();

  if (
    normalizedStatus === "completed" ||
    normalizedStatus === "installed" ||
    normalizedStatus === "received"
  ) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100";
  }

  if (
    normalizedStatus === "approved" ||
    normalizedStatus === "in_progress" ||
    normalizedStatus === "ordered"
  ) {
    return "bg-blue-50 text-blue-700 ring-blue-200 hover:bg-blue-100";
  }

  if (normalizedStatus === "waiting_parts" || normalizedStatus === "partial_received") {
    return "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100";
  }

  if (
    normalizedStatus === "blocked" ||
    normalizedStatus === "cancelled" ||
    normalizedStatus === "returned"
  ) {
    return "bg-red-50 text-red-700 ring-red-200 hover:bg-red-100";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200 hover:bg-zinc-200";
}

function StatusDropdown({ currentStatus, isUpdating, onChange, statuses = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useDismissableLayer({
    enabled: isOpen,
    onDismiss: () => setIsOpen(false),
    refs: [dropdownRef],
  });

  async function handleStatusChange(newStatus) {
    setIsOpen(false);

    if (newStatus === currentStatus || isUpdating) {
      return;
    }

    await onChange(newStatus);
  }

  return (
    <div className="relative inline-flex" ref={dropdownRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition disabled:cursor-not-allowed disabled:opacity-60 ${getStatusClassName(
          currentStatus
        )}`}
        disabled={isUpdating}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span>{formatStatusLabel(currentStatus)}</span>
        {isUpdating ? (
          <span className="text-[10px] font-semibold">Saving</span>
        ) : (
          <span
            className="h-1.5 w-1.5 rotate-45 border-b border-r border-current"
            aria-hidden="true"
          />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-8 z-20 w-44 rounded-md border border-zinc-200 bg-white p-1 shadow-lg"
          role="menu"
        >
          {statuses.map((status) => (
            <button
              className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
              key={status}
              onClick={() => handleStatusChange(status)}
              role="menuitem"
              type="button"
            >
              <span>{formatStatusLabel(status)}</span>
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

export default StatusDropdown;
