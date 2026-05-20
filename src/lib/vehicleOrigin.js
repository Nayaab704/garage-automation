export const vehicleOriginOptions = [
  { label: "Personal", value: "personal" },
  { label: "Training", value: "training" },
  { label: "Customer Trade-In", value: "customer_trade_in" },
  { label: "Auction", value: "auction" },
  { label: "Other", value: "other" },
  { label: "Unknown", value: "unknown" },
];

const vehicleOriginLabels = {
  personal: "Personal",
  training: "Training",
  customer_trade_in: "Customer Trade-In",
  auction: "Auction",
  other: "Other",
  unknown: "Unknown",
};

export function formatVehicleOrigin(origin) {
  return vehicleOriginLabels[origin] ?? "Unknown";
}

export function getVehicleOriginClassName(origin) {
  if (origin === "personal") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (origin === "training") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (origin === "customer_trade_in") {
    return "bg-violet-50 text-violet-700 ring-violet-200";
  }

  if (origin === "auction") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (origin === "other") {
    return "bg-slate-100 text-slate-700 ring-slate-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}
