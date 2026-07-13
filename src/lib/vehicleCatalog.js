import { supabase } from "./supabaseClient";

const catalogSelectColumns = [
  "id",
  "make",
  "model",
  "trim",
  "normalized_make",
  "normalized_model",
  "normalized_trim",
  "usage_count",
  "updated_at",
].join(", ");

const suggestionLimit = 8;
let catalogEntriesCache = null;
let catalogEntriesPromise = null;

export function normalizeVehicleCatalogText(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  return normalized || "";
}

function cleanCatalogText(value) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text || "";
}

function getEntryField(entry, fieldName) {
  return cleanCatalogText(entry?.[fieldName]);
}

function getEntryNormalizedField(entry, fieldName) {
  return normalizeVehicleCatalogText(entry?.[fieldName]);
}

function getUpdatedTime(entry) {
  const time = Date.parse(entry?.updated_at ?? "");
  return Number.isFinite(time) ? time : 0;
}

function matchesQuery(label, query) {
  const normalizedLabel = normalizeVehicleCatalogText(label);
  const normalizedQuery = normalizeVehicleCatalogText(query);

  if (!normalizedQuery) {
    return true;
  }

  return normalizedLabel.includes(normalizedQuery);
}

function buildDistinctSuggestions(entries, { fieldName, filter, query }) {
  const suggestionsByKey = new Map();

  entries.forEach((entry) => {
    if (typeof filter === "function" && !filter(entry)) {
      return;
    }

    const label = getEntryField(entry, fieldName);

    if (!label || !matchesQuery(label, query)) {
      return;
    }

    const key = getEntryNormalizedField(entry, fieldName);
    const currentSuggestion = suggestionsByKey.get(key);
    const usageCount = Number(entry.usage_count ?? 0);
    const updatedTime = getUpdatedTime(entry);

    if (!currentSuggestion) {
      suggestionsByKey.set(key, {
        key,
        label,
        updatedTime,
        usageCount,
        value: label,
      });
      return;
    }

    const previousUsageCount = currentSuggestion.usageCount;
    currentSuggestion.usageCount += usageCount;
    currentSuggestion.updatedTime = Math.max(
      currentSuggestion.updatedTime,
      updatedTime
    );

    if (usageCount > previousUsageCount) {
      currentSuggestion.label = label;
      currentSuggestion.value = label;
    }
  });

  return Array.from(suggestionsByKey.values())
    .sort((firstSuggestion, secondSuggestion) => {
      return firstSuggestion.label.localeCompare(secondSuggestion.label, undefined, {
        sensitivity: "base",
      });
    })
    .slice(0, suggestionLimit);
}

export function invalidateVehicleCatalogEntriesCache() {
  catalogEntriesCache = null;
  catalogEntriesPromise = null;
}

export async function fetchVehicleCatalogEntries({ force = false } = {}) {
  if (!force && catalogEntriesCache) {
    return catalogEntriesCache;
  }

  if (!force && catalogEntriesPromise) {
    return catalogEntriesPromise;
  }

  catalogEntriesPromise = supabase
    .from("vehicle_catalog_entries")
    .select(catalogSelectColumns)
    .order("usage_count", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1500)
    .then(({ data, error }) => {
      if (error) {
        throw error;
      }

      catalogEntriesCache = data ?? [];
      return catalogEntriesCache;
    })
    .finally(() => {
      catalogEntriesPromise = null;
    });

  return catalogEntriesPromise;
}

export async function recordVehicleCatalogEntrySafely({ make, model, trim }) {
  if (!normalizeVehicleCatalogText(make)) {
    return;
  }

  try {
    const { error } = await supabase.rpc("record_vehicle_catalog_entry", {
      p_make: cleanCatalogText(make),
      p_model: cleanCatalogText(model) || null,
      p_source: "user",
      p_trim: cleanCatalogText(trim) || null,
    });

    if (error) {
      console.warn("Could not record vehicle catalog entry:", error);
      return;
    }

    invalidateVehicleCatalogEntriesCache();
  } catch (error) {
    console.warn("Could not record vehicle catalog entry:", error);
  }
}

export function getMakeSuggestions(entries, query) {
  return buildDistinctSuggestions(entries, {
    fieldName: "make",
    query,
  });
}

export function getModelSuggestions(entries, make, query) {
  const normalizedMake = normalizeVehicleCatalogText(make);

  return buildDistinctSuggestions(entries, {
    fieldName: "model",
    filter: (entry) =>
      !normalizedMake || entry.normalized_make === normalizedMake,
    query,
  });
}

export function getTrimSuggestions(entries, make, model, query) {
  const normalizedMake = normalizeVehicleCatalogText(make);
  const normalizedModel = normalizeVehicleCatalogText(model);

  return buildDistinctSuggestions(entries, {
    fieldName: "trim",
    filter: (entry) => {
      const matchesMake =
        !normalizedMake || entry.normalized_make === normalizedMake;
      const matchesModel =
        !normalizedModel || entry.normalized_model === normalizedModel;

      return matchesMake && matchesModel;
    },
    query,
  });
}
