import { useState } from "react";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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
  const valueClassName = {
    default: "text-zinc-950",
    negative: "text-red-700",
    positive: "text-emerald-700",
  }[tone];

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClassName}`}>{value}</p>
    </div>
  );
}

function InvestmentSummary({ currentProfile, investmentSummary, vehicle }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const estimatedProfit = investmentSummary?.estimated_profit;
  const estimatedProfitNumber = Number(estimatedProfit ?? 0);
  const isTechnician = currentProfile?.role === "technician";

  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">
            Investment Summary
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Compact financial snapshot.
          </p>
        </div>
        {!isTechnician && (
          <button
            className="min-h-10 w-fit rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            onClick={() => setIsExpanded((isOpen) => !isOpen)}
            type="button"
          >
            {isExpanded ? "Hide Financial Details" : "View Financial Details"}
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InvestmentCard
          label="Total Invested"
          value={formatCurrency(investmentSummary?.total_invested)}
        />
        <InvestmentCard
          label="Estimated Profit"
          tone={estimatedProfitNumber < 0 ? "negative" : "positive"}
          value={formatCurrency(investmentSummary?.estimated_profit)}
        />
      </div>

      {!isTechnician && isExpanded && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
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
            tone={estimatedProfitNumber < 0 ? "negative" : "positive"}
            value={formatCurrency(investmentSummary?.estimated_profit)}
          />
        </div>
      )}
    </section>
  );
}

export default InvestmentSummary;
