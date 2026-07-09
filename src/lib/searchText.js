export function normalizeSearchText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeCompactSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function buildSearchText(values = []) {
  return normalizeSearchText(values.flat(Infinity).filter(Boolean).join(" "));
}

export function matchesSearchText(searchText, search) {
  const normalizedSearch = normalizeSearchText(search);

  if (!normalizedSearch) {
    return true;
  }

  const normalizedText = normalizeSearchText(searchText);
  const compactSearch = normalizeCompactSearchText(normalizedSearch);

  return (
    normalizedText.includes(normalizedSearch) ||
    (compactSearch &&
      normalizeCompactSearchText(normalizedText).includes(compactSearch))
  );
}

export function getVehicleContext(vehicle) {
  if (!vehicle) {
    return null;
  }

  return {
    color: vehicle.color ?? null,
    id: vehicle.id ?? null,
    make: vehicle.make ?? null,
    model: vehicle.model ?? null,
    status: vehicle.status ?? null,
    stock_number: vehicle.stock_number ?? vehicle.stockNumber ?? null,
    trim: vehicle.trim ?? null,
    vin: vehicle.vin ?? vehicle.vehicleVin ?? vehicle.vehicle_vin ?? null,
    year: vehicle.year ?? null,
  };
}

export function getVehicleSearchValues(vehicle) {
  const context = getVehicleContext(vehicle);

  if (!context) {
    return [];
  }

  return [
    context.vin,
    context.stock_number,
    context.year,
    context.make,
    context.model,
    context.trim,
    context.color,
    context.status,
  ];
}

export function getVehicleSearchText(vehicle) {
  return buildSearchText(getVehicleSearchValues(vehicle));
}

export function buildVehicleSearchIndex(vehicles = []) {
  return vehicles
    .map(getVehicleContext)
    .filter(Boolean)
    .map((vehicle) => {
      const searchText = getVehicleSearchText(vehicle);

      return {
        ...vehicle,
        compactSearchText: normalizeCompactSearchText(searchText),
        searchText,
      };
    });
}

export function findMatchingVehicles(vehicleSearchIndex = [], search) {
  const normalizedSearch = normalizeSearchText(search);

  if (!normalizedSearch) {
    return [];
  }

  const compactSearch = normalizeCompactSearchText(normalizedSearch);

  return vehicleSearchIndex.filter((vehicle) => {
    const searchText = normalizeSearchText(vehicle.searchText);

    return (
      searchText.includes(normalizedSearch) ||
      (compactSearch &&
        (vehicle.compactSearchText ?? normalizeCompactSearchText(searchText)).includes(
          compactSearch
        ))
    );
  });
}

export function uniqueVehicleContexts(vehicles = []) {
  const seenKeys = new Set();

  return vehicles
    .map(getVehicleContext)
    .filter(Boolean)
    .filter((vehicle) => {
      const vehicleKey = vehicle.id ?? vehicle.vin ?? vehicle.stock_number;

      if (!vehicleKey) {
        return true;
      }

      if (seenKeys.has(vehicleKey)) {
        return false;
      }

      seenKeys.add(vehicleKey);
      return true;
    });
}
