const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

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

function InvestmentCard({ label, tone = "default", value }) {
  const valueClassName =
    tone === "positive" ? "text-emerald-700" : "text-zinc-950";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClassName}`}>{value}</p>
    </div>
  );
}

function InvestmentSummary({ investmentSummary, vehicle }) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-zinc-950">
          Investment Summary
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Purchase, investment, and projected profit details.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InvestmentCard
          label="Purchase Price"
          value={formatCurrency(
            investmentSummary?.purchase_price ?? vehicle.purchase_price,
          )}
        />
        <InvestmentCard
          label="Total Invested"
          value={formatCurrency(investmentSummary?.total_invested)}
        />
        <InvestmentCard
          label="Estimated Profit"
          tone="positive"
          value={formatCurrency(investmentSummary?.estimated_profit)}
        />
      </div>
    </section>
  );
}

export default InvestmentSummary;
