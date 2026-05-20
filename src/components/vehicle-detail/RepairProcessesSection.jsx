import { useState } from "react";
import AddRepairProcessForm from "./AddRepairProcessForm";
import AddRepairProcessItemForm from "./AddRepairProcessItemForm";
import RepairProcessItemsList from "./RepairProcessItemsList";
import {
  formatRepairProcessStatus,
  formatRepairProcessType,
  getRepairProcessStatusClassName,
  getRepairProcessTypeClassName,
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
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

function getVendorName(vendor) {
  return (
    getFirstValue(vendor, ["name", "vendor_name", "company_name"]) ??
    "Unknown Vendor"
  );
}

function getVendorById(vendors, vendorId) {
  return vendors.find((vendor) => vendor.id === vendorId);
}

function numberOrZero(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getRepairProcessItems(repairProcessItems, repairProcessId) {
  return repairProcessItems.filter(
    (item) => item.repair_process_id === repairProcessId
  );
}

function getRepairProcessItemTotals(items) {
  return items.reduce((total, item) => total + numberOrZero(item.cost), 0);
}

function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}

function Badge({ className, children }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function RepairProcessCard({
  items,
  onAddItem,
  onItemDeleted,
  onItemUpdated,
  repairProcess,
  vendors,
}) {
  const vendor = getVendorById(vendors, repairProcess.vendor_id);
  const notes = getFirstValue(repairProcess, ["notes"]);
  const startedAt = getFirstValue(repairProcess, ["started_at"]);
  const completedAt = getFirstValue(repairProcess, ["completed_at"]);
  const processTotal = getRepairProcessItemTotals(items);

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-950">
            {formatRepairProcessType(repairProcess.process_type)}
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            {vendor ? getVendorName(vendor) : "No vendor assigned"}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Badge
              className={getRepairProcessTypeClassName(
                repairProcess.process_type
              )}
            >
              {formatRepairProcessType(repairProcess.process_type)}
            </Badge>
            <Badge
              className={getRepairProcessStatusClassName(repairProcess.status)}
            >
              {formatRepairProcessStatus(repairProcess.status)}
            </Badge>
          </div>

          <button
            className="w-fit rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
            onClick={() => onAddItem(repairProcess)}
            type="button"
          >
            Add Item
          </button>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DetailItem
          label="Vendor"
          value={vendor ? getVendorName(vendor) : "Not available"}
        />
        <DetailItem
          label="Process Total"
          value={formatCurrency(processTotal)}
        />
        <DetailItem
          label="Started"
          value={formatDate(startedAt)}
        />
        <DetailItem
          label="Completed"
          value={formatDate(completedAt)}
        />
      </dl>

      {notes && (
        <div className="mt-5 rounded-md bg-zinc-50 p-4">
          <p className="text-sm font-medium text-zinc-500">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {displayValue(notes)}
          </p>
        </div>
      )}

      <RepairProcessItemsList
        items={items}
        onItemDeleted={onItemDeleted}
        onItemUpdated={onItemUpdated}
        repairProcess={repairProcess}
      />
    </article>
  );
}

function RepairProcessesSection({
  onRepairProcessAdded,
  onRepairProcessItemAdded,
  onRepairProcessItemDeleted,
  onRepairProcessItemUpdated,
  repairProcessItems = [],
  repairProcesses = [],
  vehicleId,
  vendors = [],
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRepairProcess, setSelectedRepairProcess] = useState(null);

  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">
            Repair Processes
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {repairProcesses.length}{" "}
            {repairProcesses.length === 1 ? "record" : "records"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">
            {repairProcesses.length}
          </span>
          <button
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            onClick={() => setIsFormOpen(true)}
            type="button"
          >
            Add Repair Process
          </button>
        </div>
      </div>

      {repairProcesses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          No repair processes found for this vehicle.
        </div>
      ) : (
        <div className="space-y-3">
          {repairProcesses.map((repairProcess, index) => (
            <RepairProcessCard
              items={getRepairProcessItems(
                repairProcessItems,
                repairProcess.id
              )}
              key={repairProcess.id ?? index}
              onAddItem={setSelectedRepairProcess}
              onItemDeleted={onRepairProcessItemDeleted}
              onItemUpdated={onRepairProcessItemUpdated}
              repairProcess={repairProcess}
              vendors={vendors}
            />
          ))}
        </div>
      )}

      {isFormOpen && (
        <AddRepairProcessForm
          onClose={() => setIsFormOpen(false)}
          onRepairProcessAdded={onRepairProcessAdded}
          repairProcesses={repairProcesses}
          vehicleId={vehicleId}
          vendors={vendors}
        />
      )}

      {selectedRepairProcess && (
        <AddRepairProcessItemForm
          onClose={() => setSelectedRepairProcess(null)}
          onItemAdded={onRepairProcessItemAdded}
          repairProcess={selectedRepairProcess}
          vehicleId={vehicleId}
        />
      )}
    </section>
  );
}

export default RepairProcessesSection;
