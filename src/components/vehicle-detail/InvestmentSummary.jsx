import { useState } from "react";
import AppIcon from "../ui/AppIcon";
import { isAdminOrManagerRole } from "../../lib/permissions";
import { calculateVehicleFinancialSummary } from "../../lib/vehicleFinancials";

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

function InvestmentCard({ className = "", label, tone = "default", value }) {
  const valueClassName = {
    default: "text-slate-950",
    negative: "text-red-700",
    positive: "text-emerald-700",
  }[tone];
  const cardClassName = {
    default: "border-slate-100 bg-slate-50",
    negative: "border-red-100 bg-red-50/70",
    positive: "border-emerald-100 bg-emerald-50/70",
  }[tone];

  return (
    <div
      className={`min-w-0 rounded-xl border p-3 ${cardClassName} ${className}`}
    >
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
        {label}
      </p>
      <p
        className={`mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-base font-black leading-tight tracking-tight tabular-nums sm:text-lg ${valueClassName}`}
      >
        {value}
      </p>
    </div>
  );
}

function InvestmentSummary({
  costEntries,
  currentProfile,
  laborLogs,
  partRequests,
  purchaseOrderItems,
  purchaseOrders,
  thirdPartyRepairs,
  vehicle,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const financialSummary = calculateVehicleFinancialSummary({
    costEntries,
    laborLogs,
    partRequests,
    purchaseOrderItems,
    purchaseOrders,
    thirdPartyRepairs,
    vehicle,
  });
  const profitTone =
    financialSummary.estimatedProfit > 0
      ? "positive"
      : financialSummary.estimatedProfit < 0
        ? "negative"
        : "default";
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
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3 sm:gap-3 sm:p-4">
          <InvestmentCard
            label="Purchase Price"
            value={formatCurrency(financialSummary.purchasePrice)}
          />
          <InvestmentCard
            label="Total Repair Cost"
            value={formatCurrency(financialSummary.totalRepairCost)}
          />
          <InvestmentCard
            label="Total Invested"
            value={formatCurrency(financialSummary.totalInvested)}
          />
          <InvestmentCard
            label="Target Sale Price"
            value={
              financialSummary.targetSalePrice === null
                ? "Not set"
                : formatCurrency(financialSummary.targetSalePrice)
            }
          />
          <InvestmentCard
            className="col-span-2"
            label="Estimated Profit"
            tone={profitTone}
            value={
              financialSummary.estimatedProfit === null
                ? "Not available"
                : formatCurrency(financialSummary.estimatedProfit)
            }
          />
        </div>
      )}
    </section>
  );
}

export default InvestmentSummary;
