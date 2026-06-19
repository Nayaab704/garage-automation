import { useState } from "react";
import AddExtraCostForm from "./AddExtraCostForm";
import AppIcon from "../ui/AppIcon";
import VehicleDetailSection from "./VehicleDetailSection";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

const costTypeLabels = {
  auction_fee: "Auction Fee",
  towing: "Towing",
  detailing: "Detailing",
  paint_material: "Paint Material",
  title_fee: "Title Fee",
  misc: "Misc",
};

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "Not available";
  }

  return currencyFormatter.format(numberValue);
}

function formatDate(value) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCostType(costType) {
  if (!costType) {
    return "Not available";
  }

  return (
    costTypeLabels[costType] ??
    costType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

function getFirstValue(record, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = record[fieldName];

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

function getExtraCostTotal(costEntries) {
  return costEntries.reduce((total, costEntry) => {
    const amount = Number(getFirstValue(costEntry, ["amount", "cost"]) ?? 0);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

function ExtraCostCard({ canManage, costEntry, isDeleting, onDelete }) {
  const costType = getFirstValue(costEntry, ["cost_type", "type"]);
  const amount = getFirstValue(costEntry, ["amount", "cost"]);
  const description = getFirstValue(costEntry, ["description"]);
  const notes = getFirstValue(costEntry, ["notes"]);
  const date = getFirstValue(costEntry, [
    "cost_date",
    "expense_date",
    "date",
    "created_at",
  ]);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-950">
            {formatCostType(costType)}
          </h3>
          {description && (
            <p className="mt-1 text-sm leading-5 text-slate-600">
              {displayValue(description)}
            </p>
          )}
          {notes && notes !== description && (
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {displayValue(notes)}
            </p>
          )}
          <p className="mt-1 text-xs font-medium text-slate-400">
            {formatDate(date)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-right text-sm font-bold text-slate-800 ring-1 ring-inset ring-slate-200">
            {formatCurrency(amount)}
          </div>
          {canManage && (
            <button
              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isDeleting}
              onClick={() => onDelete(costEntry.id)}
              type="button"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function ExtraCostsSection({
  canManage = false,
  costEntries = [],
  onActivityLogged,
  onExtraCostChanged,
  vehicleId,
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletingCostEntryId, setDeletingCostEntryId] = useState(null);
  const extraCostTotal = getExtraCostTotal(costEntries);
  const costCountLabel = `${costEntries.length} ${
    costEntries.length === 1 ? "record" : "records"
  }`;

  async function handleDelete(costEntryId) {
    if (!canManage) {
      setDeleteError("Your role cannot delete extra costs.");
      return;
    }

    if (!costEntryId) {
      setDeleteError("Unable to delete an extra cost without an ID.");
      return;
    }

    const confirmed = window.confirm(
      "Delete this extra cost? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setDeleteError("");
    setDeletingCostEntryId(costEntryId);

    try {
      const costEntry = costEntries.find((entry) => entry.id === costEntryId);
      const { error } = await supabase
        .from("cost_entries")
        .delete()
        .eq("id", costEntryId);

      if (error) {
        setDeleteError(error.message);
        return;
      }

      await logVehicleActivity({
        vehicleId,
        action: "Extra cost deleted",
        details: {
          amount: getFirstValue(costEntry ?? {}, ["amount", "cost"]),
          cost_type: getFirstValue(costEntry ?? {}, ["cost_type", "type"]),
          description: getFirstValue(costEntry ?? {}, [
            "description",
            "notes",
          ]),
        },
      });
      onActivityLogged?.();
      await onExtraCostChanged();
    } catch (error) {
      setDeleteError(error.message ?? "Something went wrong.");
    } finally {
      setDeletingCostEntryId(null);
    }
  }

  return (
    <VehicleDetailSection
      badge={formatCurrency(extraCostTotal)}
      icon="dollar"
      summary={costCountLabel}
      title="Extra Costs"
    >
      <div className="space-y-4">
        {canManage && (
          <div className="flex justify-end">
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
              onClick={() => setIsFormOpen(true)}
              type="button"
            >
              <AppIcon name="plus" size={17} />
              Add Extra Cost
            </button>
          </div>
        )}

        {costEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-sm text-slate-500">
            No extra costs found for this vehicle.
          </div>
        ) : (
          <div className="space-y-2.5">
            {costEntries.map((costEntry, index) => (
              <ExtraCostCard
                canManage={canManage}
                costEntry={costEntry}
                isDeleting={deletingCostEntryId === costEntry.id}
                key={costEntry.id ?? index}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {deleteError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {deleteError}
        </div>
      )}

      {isFormOpen && canManage && (
        <AddExtraCostForm
          onClose={() => setIsFormOpen(false)}
          onActivityLogged={onActivityLogged}
          onExtraCostAdded={onExtraCostChanged}
          vehicleId={vehicleId}
        />
      )}
    </VehicleDetailSection>
  );
}

export default ExtraCostsSection;
