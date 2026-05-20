import { useState } from "react";
import AddExtraCostForm from "./AddExtraCostForm";
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

function ExtraCostCard({ costEntry, isDeleting, onDelete }) {
  const costType = getFirstValue(costEntry, ["cost_type", "type"]);
  const amount = getFirstValue(costEntry, ["amount", "cost"]);
  const description = getFirstValue(costEntry, ["description", "notes"]);

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-950">
            {formatCostType(costType)}
          </h3>
          {description && (
            <p className="mt-1 text-sm text-zinc-500">
              {displayValue(description)}
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 sm:flex-col sm:items-end">
          <div className="rounded-md bg-zinc-100 px-3 py-2 text-right text-sm font-bold text-zinc-800 ring-1 ring-inset ring-zinc-200">
            {formatCurrency(amount)}
          </div>
          <button
            className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDeleting}
            onClick={() => onDelete(costEntry.id)}
            type="button"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </article>
  );
}

function ExtraCostsSection({
  costEntries = [],
  onActivityLogged,
  onExtraCostChanged,
  vehicleId,
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletingCostEntryId, setDeletingCostEntryId] = useState(null);

  async function handleDelete(costEntryId) {
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
    <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">Extra Costs</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {costEntries.length}{" "}
            {costEntries.length === 1 ? "record" : "records"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">
            {costEntries.length}
          </span>
          <button
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            onClick={() => setIsFormOpen(true)}
            type="button"
          >
            Add Extra Cost
          </button>
        </div>
      </div>

      {costEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          No extra costs found for this vehicle.
        </div>
      ) : (
        <div className="space-y-3">
          {costEntries.map((costEntry, index) => (
            <ExtraCostCard
              costEntry={costEntry}
              isDeleting={deletingCostEntryId === costEntry.id}
              key={costEntry.id ?? index}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {deleteError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {deleteError}
        </div>
      )}

      {isFormOpen && (
        <AddExtraCostForm
          onClose={() => setIsFormOpen(false)}
          onActivityLogged={onActivityLogged}
          onExtraCostAdded={onExtraCostChanged}
          vehicleId={vehicleId}
        />
      )}
    </section>
  );
}

export default ExtraCostsSection;
