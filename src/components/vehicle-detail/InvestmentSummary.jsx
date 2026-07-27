import { useState } from "react";
import AppIcon from "../ui/AppIcon";
import { isAdminOrManagerRole } from "../../lib/permissions";

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
    default: "text-slate-950",
    negative: "text-red-700",
    positive: "text-emerald-700",
  }[tone];

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-xl font-black tabular-nums ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

function InvestmentSummary({ currentProfile, investmentSummary, vehicle }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const estimatedProfit = investmentSummary?.estimated_profit;
  const estimatedProfitNumber = Number(estimatedProfit ?? 0);
  const profitTone = estimatedProfitNumber < 0 ? "negative" : "positive";
  const canViewFinancialDetails = isAdminOrManagerRole(currentProfile?.role);

  if (!canViewFinancialDetails) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
        onClick={() => setIsExpanded((isOpen) => !isOpen)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
            <AppIcon name="dollar" size={22} />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-slate-950">
              Financial Details
            </span>
          </span>
        </span>

        <AppIcon
          className={`shrink-0 text-slate-500 transition ${
            isExpanded ? "rotate-90" : ""
          }`}
          name="chevron-right"
          size={20}
        />
      </button>

      {isExpanded && (
        <div className="grid gap-3 border-t border-slate-100 p-4 md:grid-cols-3">
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
            tone={profitTone}
            value={formatCurrency(investmentSummary?.estimated_profit)}
          />
        </div>
      )}
    </section>
  );
}

export default InvestmentSummary;
