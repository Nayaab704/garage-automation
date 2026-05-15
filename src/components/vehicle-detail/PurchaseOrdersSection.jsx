import { useState } from "react";
import CreatePurchaseOrderForm from "./CreatePurchaseOrderForm";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US");

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

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "Not available";
  }

  return numberFormatter.format(numberValue);
}

function formatStatusLabel(status) {
  if (!status) {
    return "Not available";
  }

  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

function getPartRequestName(partRequest) {
  return (
    getFirstValue(partRequest, ["part_name", "name", "part"]) ??
    "Part Request"
  );
}

function getPurchaseOrderItems(purchaseOrder, purchaseOrderItems) {
  return purchaseOrderItems.filter(
    (item) => item.purchase_order_id === purchaseOrder.id
  );
}

function getVendorById(vendors, vendorId) {
  return vendors.find((vendor) => vendor.id === vendorId);
}

function getPartRequestById(partRequests, partRequestId) {
  return partRequests.find((partRequest) => partRequest.id === partRequestId);
}

function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}

function PurchaseOrderItem({ item, partRequests }) {
  const partRequest = getPartRequestById(partRequests, item.part_request_id);
  const description = getFirstValue(item, ["description", "name"]) ?? "Item";
  const notes = getFirstValue(item, ["notes"]);

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-zinc-950">{description}</h4>
          <p className="mt-1 text-sm text-zinc-500">
            Part Request:{" "}
            {partRequest ? getPartRequestName(partRequest) : "Not available"}
          </p>
        </div>

        <p className="text-sm font-semibold text-zinc-700">
          Qty {formatNumber(item.quantity)}
        </p>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <DetailItem label="Unit Cost" value={formatCurrency(item.unit_cost)} />
        <DetailItem
          label="Shipping"
          value={formatCurrency(item.shipping_cost)}
        />
        <DetailItem label="Tax" value={formatCurrency(item.tax)} />
      </dl>

      {notes && (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
          {notes}
        </p>
      )}
    </div>
  );
}

function PurchaseOrderCard({
  partRequests,
  purchaseOrder,
  purchaseOrderItems,
  vendors,
}) {
  const vendor = getVendorById(vendors, purchaseOrder.vendor_id);
  const items = getPurchaseOrderItems(purchaseOrder, purchaseOrderItems);
  const status = getFirstValue(purchaseOrder, ["status"]);
  const orderedAt = getFirstValue(purchaseOrder, ["ordered_at", "created_at"]);
  const notes = getFirstValue(purchaseOrder, ["notes"]);

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-950">
            {vendor ? getVendorName(vendor) : "Unknown Vendor"}
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Ordered {formatDate(orderedAt)}
          </p>
        </div>

        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
          {formatStatusLabel(status)}
        </span>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <DetailItem
          label="Vendor"
          value={vendor ? getVendorName(vendor) : "Not available"}
        />
        <DetailItem label="Items" value={formatNumber(items.length)} />
      </dl>

      {items.length > 0 ? (
        <div className="mt-5 space-y-3">
          {items.map((item, index) => (
            <PurchaseOrderItem
              item={item}
              key={item.id ?? index}
              partRequests={partRequests}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500">
          No items found for this purchase order.
        </div>
      )}

      {notes && (
        <div className="mt-5 rounded-md bg-zinc-50 p-4">
          <p className="text-sm font-medium text-zinc-500">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {displayValue(notes)}
          </p>
        </div>
      )}
    </article>
  );
}

function PurchaseOrdersSection({
  onPurchaseOrderCreated,
  partRequests = [],
  purchaseOrderItems = [],
  purchaseOrders = [],
  vehicleId,
  vendors = [],
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">
            Purchase Orders
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {purchaseOrders.length}{" "}
            {purchaseOrders.length === 1 ? "record" : "records"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">
            {purchaseOrders.length}
          </span>
          <button
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            onClick={() => setIsFormOpen(true)}
            type="button"
          >
            Create Purchase Order
          </button>
        </div>
      </div>

      {purchaseOrders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          No purchase orders found for this vehicle.
        </div>
      ) : (
        <div className="space-y-3">
          {purchaseOrders.map((purchaseOrder, index) => (
            <PurchaseOrderCard
              key={purchaseOrder.id ?? index}
              partRequests={partRequests}
              purchaseOrder={purchaseOrder}
              purchaseOrderItems={purchaseOrderItems}
              vendors={vendors}
            />
          ))}
        </div>
      )}

      {isFormOpen && (
        <CreatePurchaseOrderForm
          onClose={() => setIsFormOpen(false)}
          onPurchaseOrderCreated={onPurchaseOrderCreated}
          partRequests={partRequests}
          vehicleId={vehicleId}
          vendors={vendors}
        />
      )}
    </section>
  );
}

export default PurchaseOrdersSection;
