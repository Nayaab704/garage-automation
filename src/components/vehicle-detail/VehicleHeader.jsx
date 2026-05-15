const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const numberFormatter = new Intl.NumberFormat("en-US");

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatCurrency(value) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "Not available";
  }

  return currencyFormatter.format(numberValue);
}

function formatNumber(value) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "Not available";
  }

  return numberFormatter.format(numberValue);
}

function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}

function VehicleHeader({ vehicle }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Stock Number</p>
          <h2 className="mt-1 text-3xl font-bold text-zinc-950">
            {displayValue(vehicle.stock_number)}
          </h2>
          <p className="mt-2 text-lg font-semibold text-zinc-800">
            {displayValue(vehicle.year)} {displayValue(vehicle.make)}{" "}
            {displayValue(vehicle.model)}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {displayValue(vehicle.trim)}
          </p>
        </div>

        <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
          {displayValue(vehicle.color)}
        </span>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DetailItem
          label="VIN"
          value={displayValue(vehicle.vin)}
        />
        <DetailItem
          label="Mileage"
          value={formatNumber(vehicle.mileage)}
        />
        <DetailItem
          label="Purchase Price"
          value={formatCurrency(vehicle.purchase_price)}
        />
        <DetailItem
          label="Target Sale Price"
          value={formatCurrency(vehicle.target_sale_price)}
        />
      </dl>

      {vehicle.notes && (
        <div className="mt-6 rounded-md bg-zinc-50 p-4">
          <p className="text-sm font-medium text-zinc-500">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {vehicle.notes}
          </p>
        </div>
      )}
    </section>
  );
}

export default VehicleHeader;
