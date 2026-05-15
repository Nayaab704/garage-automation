const numberFormatter = new Intl.NumberFormat("en-US");

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
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

function getFirstValue(record, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = record[fieldName];

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

function statusClassName(status) {
  const normalizedStatus = String(status ?? "").toLowerCase();

  if (normalizedStatus.includes("complete") || normalizedStatus === "done") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (normalizedStatus.includes("hold") || normalizedStatus.includes("wait")) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (normalizedStatus.includes("cancel")) {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
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

function PartRequestCard({ partRequest }) {
  const partName =
    getFirstValue(partRequest, ["part_name", "name", "part"]) ??
    "Part Request";
  const quantity = getFirstValue(partRequest, ["quantity", "qty"]);
  const status = getFirstValue(partRequest, ["status"]);
  const notes = getFirstValue(partRequest, ["notes", "description"]);

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-950">{partName}</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Quantity: {formatNumber(quantity)}
          </p>
        </div>

        <Badge className={statusClassName(status)}>
          {displayValue(status)}
        </Badge>
      </div>

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

function PartRequestsSection({ partRequests }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">Part Requests</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {partRequests.length}{" "}
            {partRequests.length === 1 ? "record" : "records"}
          </p>
        </div>

        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">
          {partRequests.length}
        </span>
      </div>

      {partRequests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          No part requests found for this vehicle.
        </div>
      ) : (
        <div className="space-y-3">
          {partRequests.map((partRequest, index) => (
            <PartRequestCard
              key={partRequest.id ?? index}
              partRequest={partRequest}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default PartRequestsSection;
