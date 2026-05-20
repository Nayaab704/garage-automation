import {
  formatRepairProcessItemStatus,
  getRepairProcessItemStatusClassName,
} from "../../lib/repairProcess";

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

function numberOrZero(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getItemTotals(items) {
  return items.reduce(
    (totals, item) => ({
      actualCost: totals.actualCost + numberOrZero(item.actual_cost),
      estimatedCost: totals.estimatedCost + numberOrZero(item.estimated_cost),
    }),
    { actualCost: 0, estimatedCost: 0 }
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}

function RepairProcessItemCard({ item }) {
  return (
    <article className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-zinc-950">
            {displayValue(item.category_name)}
          </h4>
        </div>

        <span
          className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getRepairProcessItemStatusClassName(
            item.status
          )}`}
        >
          {formatRepairProcessItemStatus(item.status)}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <DetailItem
          label="Estimated Cost"
          value={formatCurrency(item.estimated_cost)}
        />
        <DetailItem
          label="Actual Cost"
          value={formatCurrency(item.actual_cost)}
        />
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

function RepairProcessItemsList({ items = [] }) {
  const totals = getItemTotals(items);

  return (
    <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-zinc-950">Process Items</h4>
          <p className="mt-1 text-sm text-zinc-500">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md bg-white px-3 py-2 ring-1 ring-inset ring-zinc-200">
            <p className="text-xs font-medium text-zinc-500">
              Estimated Total
            </p>
            <p className="text-sm font-bold text-zinc-950">
              {formatCurrency(totals.estimatedCost)}
            </p>
          </div>
          <div className="rounded-md bg-white px-3 py-2 ring-1 ring-inset ring-zinc-200">
            <p className="text-xs font-medium text-zinc-500">Actual Total</p>
            <p className="text-sm font-bold text-zinc-950">
              {formatCurrency(totals.actualCost)}
            </p>
          </div>
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
              item={item}
              key={item.id ?? index}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default RepairProcessItemsList;
