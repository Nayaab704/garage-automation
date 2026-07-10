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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const prebooking = getActivePrebooking(prebookings);
  const hasPrebooking = Boolean(prebooking);
  const statusLabel = getPrebookingStatusLabel(prebooking?.status);
  const depositLabel =
    formatPrebookingCurrency(prebooking?.deposit_amount, { detailed: true }) ||
    "$0.00";

  if (!hasPrebooking && !canManage) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100">
              <AppIcon name="dollar" size={18} />
            </span>
            {hasPrebooking ? (
              <VehiclePrebookingBadge prebooking={prebooking} />
            ) : (
              <h2 className="text-base font-black text-slate-950">
                Prebooking
              </h2>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {hasPrebooking
              ? "Reservation and deposit details are tracked separately from repair status."
              : "Reserve this vehicle for a customer without changing workflow status."}
          </p>
        </div>

        {canManage && (
          <button
            className={`shrink-0 ${buttonClassNames.secondary}`}
            onClick={() => setIsModalOpen(true)}
            type="button"
          >
            <AppIcon name={hasPrebooking ? "checklist" : "plus"} size={17} />
            {hasPrebooking ? "Edit" : "Add Prebooking"}
          </button>
        )}
      </div>

      {hasPrebooking && (
        <div className="mt-3 grid gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-4">
          {canManage && (
            <>
              <PrebookingMeta
                label="Customer"
                value={displayValue(prebooking.customer_name)}
              />
              <PrebookingMeta
                label="Phone"
                value={displayValue(prebooking.customer_phone)}
              />
            </>
          )}
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
