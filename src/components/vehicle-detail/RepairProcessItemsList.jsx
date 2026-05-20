import { useState } from "react";
import EditRepairProcessItemForm from "./EditRepairProcessItemForm";
import {
  formatRepairProcessItemStatus,
  getRepairProcessItemStatusClassName,
} from "../../lib/repairProcess";
import { supabase } from "../../lib/supabaseClient";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatCurrency(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return currencyFormatter.format(0);
  }

  return currencyFormatter.format(numberValue);
}

function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}

function RepairProcessItemCard({
  canManage,
  isDeleting,
  item,
  onDelete,
  onEdit,
}) {
  return (
    <article className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-zinc-950">
            {displayValue(item.category_name)}
          </h4>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span
            className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getRepairProcessItemStatusClassName(
              item.status
            )}`}
          >
            {formatRepairProcessItemStatus(item.status)}
          </span>
          {canManage && (
            <>
              <button
                className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isDeleting}
                onClick={() => onEdit(item)}
                type="button"
              >
                Edit
              </button>
              <button
                className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isDeleting}
                onClick={() => onDelete(item.id)}
                type="button"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </>
          )}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <DetailItem label="Cost" value={formatCurrency(item.cost)} />
      </dl>

      {item.notes && (
        <div className="mt-4 rounded-md bg-zinc-50 p-3">
          <p className="text-sm font-medium text-zinc-500">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {item.notes}
          </p>
        </div>
      )}
    </article>
  );
}

function RepairProcessItemsList({
  canManage = false,
  items = [],
  onItemDeleted = async () => {},
  onItemUpdated = async () => {},
  repairProcess,
}) {
  const [deleteError, setDeleteError] = useState("");
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  async function handleDelete(itemId) {
    if (!canManage) {
      setDeleteError("Your role cannot delete repair process items.");
      return;
    }

    if (!itemId) {
      setDeleteError("Unable to delete this item without an ID.");
      return;
    }

    const confirmed = window.confirm(
      "Delete this repair process item? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setDeleteError("");
    setDeletingItemId(itemId);

    try {
      const { error } = await supabase
        .from("repair_process_items")
        .delete()
        .eq("id", itemId);

      if (error) {
        setDeleteError(error.message);
        return;
      }

      await onItemDeleted(itemId);
    } catch (error) {
      setDeleteError(error.message ?? "Something went wrong.");
    } finally {
      setDeletingItemId(null);
    }
  }

  async function handleItemUpdated(updatedItem) {
    if (!canManage) {
      return;
    }

    await onItemUpdated(updatedItem);
    setEditingItem(null);
  }

  return (
    <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-zinc-950">Process Items</h4>
          <p className="mt-1 text-sm text-zinc-500">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
          No items have been added to this repair process yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item, index) => (
            <RepairProcessItemCard
              canManage={canManage}
              isDeleting={deletingItemId === item.id}
              item={item}
              key={item.id ?? index}
              onDelete={handleDelete}
              onEdit={setEditingItem}
            />
          ))}
        </div>
      )}

      {deleteError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {deleteError}
        </div>
      )}

      {editingItem && canManage && (
        <EditRepairProcessItemForm
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onItemUpdated={handleItemUpdated}
          repairProcess={repairProcess}
        />
      )}
    </div>
  );
}

export default RepairProcessItemsList;
