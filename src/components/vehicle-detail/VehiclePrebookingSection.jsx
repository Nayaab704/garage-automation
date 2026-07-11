import { useState } from "react";
import VehiclePrebookingBadge from "../VehiclePrebookingBadge";
import AppIcon from "../ui/AppIcon";
import { buttonClassNames } from "../ui/uiStyles";
import {
  formatPrebookingCurrency,
  getActivePrebooking,
  getPrebookingStatusLabel,
  isActivePrebooking,
} from "../../lib/vehiclePrebookings";
import VehiclePrebookingModal from "./VehiclePrebookingModal";

function displayValue(value) {
  return value === null || value === undefined || value === "" ? "Not set" : value;
}

function PrebookingMeta({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function VehiclePrebookingSection({
  canManage = false,
  currentProfile,
  onPrebookingSaved,
  prebookings = [],
  vehicle,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const prebooking = getActivePrebooking(prebookings);
  const hasPrebooking = Boolean(prebooking);

  if (!canManage) {
    return null;
  }

  const statusLabel = getPrebookingStatusLabel(prebooking?.status);
  const depositLabel =
    formatPrebookingCurrency(prebooking?.deposit_amount, { detailed: true }) ||
    "$0.00";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {hasPrebooking ? (
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-2xl p-1">
            <button
              aria-expanded={isExpanded}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onClick={() => setIsExpanded((currentValue) => !currentValue)}
              type="button"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100">
                <AppIcon name="dollar" size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <VehiclePrebookingBadge
                    prebooking={prebooking}
                    showAmount={false}
                    showIcon={false}
                  />
                  <span className="text-sm font-black text-slate-800">
                    Deposit {depositLabel}
                  </span>
                </span>
                <span className="mt-1 block text-xs font-semibold text-slate-500">
                  {isExpanded
                    ? "Hide prebooking details"
                    : "Show prebooking details"}
                </span>
              </span>
            </button>
            {canManage && (
              <button
                aria-label="Edit prebooking"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsModalOpen(true);
                }}
                title="Edit prebooking"
                type="button"
              >
                <AppIcon name="edit" size={16} />
              </button>
            )}
            <button
              aria-expanded={isExpanded}
              aria-label={
                isExpanded ? "Collapse prebooking details" : "Expand prebooking details"
              }
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onClick={() => setIsExpanded((currentValue) => !currentValue)}
              title={
                isExpanded ? "Collapse prebooking details" : "Expand prebooking details"
              }
              type="button"
            >
              <AppIcon
                name={isExpanded ? "chevron-down" : "chevron-right"}
                size={18}
              />
            </button>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100">
                <AppIcon name="dollar" size={18} />
              </span>
              <h2 className="text-base font-black text-slate-950">
                Prebooking
              </h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Reserve this vehicle for a customer without changing workflow status.
            </p>
          </div>
        )}

        {!hasPrebooking && canManage && (
          <button
            className={`shrink-0 ${buttonClassNames.secondary}`}
            onClick={() => setIsModalOpen(true)}
            type="button"
          >
            <AppIcon name="plus" size={17} />
            Add Prebooking
          </button>
        )}
      </div>

      {hasPrebooking && isExpanded && (
        <div className="mt-3 grid gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-4">
          <PrebookingMeta
            label="Customer"
            value={displayValue(prebooking.customer_name)}
          />
          <PrebookingMeta
            label="Phone"
            value={displayValue(prebooking.customer_phone)}
          />
          <PrebookingMeta label="Deposit" value={depositLabel} />
          <PrebookingMeta
            label="Status"
            value={isActivePrebooking(prebooking) ? "Active" : statusLabel}
          />
        </div>
      )}

      {isModalOpen && canManage && (
        <VehiclePrebookingModal
          currentProfile={currentProfile}
          onClose={() => setIsModalOpen(false)}
          onSaved={onPrebookingSaved}
          prebooking={prebooking}
          vehicle={vehicle}
          vehicleId={vehicle?.id}
        />
      )}
    </section>
  );
}

export default VehiclePrebookingSection;
