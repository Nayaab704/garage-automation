import { getWarrantyStatus } from "../lib/warranty";

const statusClassNames = {
  danger: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

function WarrantyStatusBadge({ endDate, status: providedStatus }) {
  const status = providedStatus ?? getWarrantyStatus(endDate);

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-bold ${
        statusClassNames[status.tone] ?? statusClassNames.neutral
      }`}
    >
      {status.label}
    </span>
  );
}

export default WarrantyStatusBadge;

