const STORAGE_KEY = "garage:lastVehicleContext";
const CONTEXT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hasStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function isFreshContext(context) {
  const updatedAt = Number(context?.updatedAt ?? 0);

  return updatedAt > 0 && Date.now() - updatedAt < CONTEXT_TTL_MS;
}

export function buildVehicleReturnLabel(vehicle) {
  const stockNumber = vehicle?.stock_number || "Vehicle";
  const vehicleName = [
    vehicle?.year,
    vehicle?.make,
    vehicle?.model,
    vehicle?.trim,
  ]
    .filter(Boolean)
    .join(" ");

  return vehicleName ? `${stockNumber} - ${vehicleName}` : stockNumber;
}

export function normalizeVehicleContext(context) {
  if (!context?.vehicleId) {
    return null;
  }

  return {
    expandedWorkOrderId: context.expandedWorkOrderId ?? null,
    label: context.label || context.stockNumber || "Current vehicle",
    make: context.make ?? null,
    model: context.model ?? null,
    path: context.path || "vehicleDetail",
    scrollY:
      typeof context.scrollY === "number" && Number.isFinite(context.scrollY)
        ? context.scrollY
        : null,
    selectedServiceCategory: context.selectedServiceCategory ?? null,
    stockNumber: context.stockNumber ?? null,
    target: context.target || context.path || "vehicleDetail",
    timestamp: context.timestamp ?? Date.now(),
    trim: context.trim ?? null,
    updatedAt: context.updatedAt ?? Date.now(),
    vehicleId: context.vehicleId,
    year: context.year ?? null,
  };
}

export function getLastVehicleContext() {
  if (!hasStorage()) {
    return null;
  }

  try {
    const rawContext = window.localStorage.getItem(STORAGE_KEY);

    if (!rawContext) {
      return null;
    }

    const context = normalizeVehicleContext(JSON.parse(rawContext));

    if (!context || !isFreshContext(context)) {
      clearLastVehicleContext();
      return null;
    }

    return context;
  } catch (error) {
    console.error("Could not read vehicle navigation context:", error);
    clearLastVehicleContext();
    return null;
  }
}

export function saveLastVehicleContext(context) {
  const normalizedContext = normalizeVehicleContext({
    ...context,
    updatedAt: Date.now(),
  });

  if (!normalizedContext) {
    return null;
  }

  if (hasStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedContext));
    } catch (error) {
      console.error("Could not save vehicle navigation context:", error);
    }
  }

  return normalizedContext;
}

export function clearLastVehicleContext() {
  if (!hasStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Could not clear vehicle navigation context:", error);
  }
}
