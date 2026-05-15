const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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

function getWarrantyForSale(warranties, saleId) {
  return warranties.find((warranty) => warranty.sale_id === saleId);
}

function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}

function SaleCard({ sale, warranty }) {
  const customerName = getFirstValue(sale, ["customer_name", "customer"]);
  const customerPhone = getFirstValue(sale, ["customer_phone", "phone"]);
  const paymentMethod = getFirstValue(sale, ["payment_method"]);
  const saleDate = getFirstValue(sale, ["sale_date", "sold_at", "created_at"]);
  const notes = getFirstValue(sale, ["notes"]);
  const warrantyStartDate = warranty
    ? getFirstValue(warranty, ["start_date", "warranty_start_date"])
    : null;
  const warrantyEndDate = warranty
    ? getFirstValue(warranty, ["end_date", "warranty_end_date"])
    : null;
  const warrantyTerms = warranty
    ? getFirstValue(warranty, ["terms", "warranty_terms"])
    : null;

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-950">
            {displayValue(customerName)}
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Sold {formatDate(saleDate)}
          </p>
        </div>

        <span className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
          {formatCurrency(sale.sale_price)}
        </span>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <DetailItem label="Customer Phone" value={displayValue(customerPhone)} />
        <DetailItem label="Payment Method" value={displayValue(paymentMethod)} />
        <DetailItem label="Sale Date" value={formatDate(saleDate)} />
      </dl>

      {warranty ? (
        <div className="mt-5 rounded-md border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-bold text-blue-900">Warranty</p>
          <dl className="mt-3 grid gap-4 sm:grid-cols-3">
            <DetailItem
              label="Type"
              value={displayValue(warranty.warranty_type)}
            />
            <DetailItem
              label="Start Date"
              value={formatDate(warrantyStartDate)}
            />
            <DetailItem
              label="End Date"
              value={formatDate(warrantyEndDate)}
            />
          </dl>

          {warrantyTerms && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-blue-900">
              {warrantyTerms}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500">
          No warranty was recorded for this sale.
        </div>
      )}

      {notes && (
        <div className="mt-5 rounded-md bg-zinc-50 p-4">
          <p className="text-sm font-medium text-zinc-500">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {notes}
          </p>
        </div>
      )}
    </article>
  );
}

function SaleWarrantySection({ sales = [], warranties = [] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-zinc-950">Sale / Warranty</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Sale details and warranty coverage for this vehicle.
        </p>
      </div>

      {sales.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          No sale details found for this sold vehicle.
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map((sale, index) => (
            <SaleCard
              key={sale.id ?? index}
              sale={sale}
              warranty={getWarrantyForSale(warranties, sale.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default SaleWarrantySection;
