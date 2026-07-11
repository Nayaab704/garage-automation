const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

export function numberOrZero(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function calculateLaborCost(hours, hourlyRate) {
  return numberOrZero(hours) * numberOrZero(hourlyRate);
}

export function getLaborLogCost(laborLog) {
  const savedCost = Number(laborLog?.labor_cost);

  if (Number.isFinite(savedCost)) {
    return savedCost;
  }

  return calculateLaborCost(laborLog?.hours, laborLog?.hourly_rate);
}

export function getProfileHourlyRate(profile) {
  return Math.max(0, numberOrZero(profile?.hourly_rate));
}

export function formatCurrency(value) {
  return currencyFormatter.format(numberOrZero(value));
}

export function formatHourlyRate(value) {
  return `${formatCurrency(value)}/hr`;
}

