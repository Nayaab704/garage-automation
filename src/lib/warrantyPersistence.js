import { supabase } from "./supabaseClient";
import {
  createWarrantyRecordValues,
  getWarrantyDateValue,
  prepareWarrantyRecordForPersistence,
} from "./warranty";

export const warrantyRecordColumns =
  "id,sale_id,warranty_type,start_date,end_date,terms,warranty_months,created_at";

function createWarrantyPersistenceError(message, code) {
  const error = new Error(message);
  error.code = code;
  error.details = null;
  error.hint = null;
  return error;
}

export function logWarrantyPersistenceError(context, error) {
  console.error(context, {
    code: error?.code ?? null,
    details: error?.details ?? null,
    error,
    hint: error?.hint ?? null,
    message: error?.message ?? null,
  });
}

export function getWarrantyPersistenceErrorMessage(error) {
  if (error?.code === "WARRANTY_SALE_REQUIRED") {
    return "A sale record is required before adding a warranty.";
  }

  if (error?.code === "WARRANTY_DATES_REQUIRED") {
    return "Choose a valid warranty start date and period.";
  }

  if (error?.code === "42501") {
    return "Your account is not allowed to manage warranties. Confirm that your profile is active and has an authorized sales role.";
  }

  if (error?.code === "23503") {
    return "The linked sale no longer exists. Refresh the Warranty Register and try again.";
  }

  if (error?.code === "23514") {
    return "Choose a warranty period from 1 to 12 months.";
  }

  if (error?.code === "23505") {
    return "A warranty already exists for this sale. Refresh and try again.";
  }

  return "Could not save the warranty. Please try again.";
}

async function findLatestWarrantyForSale(saleId, context) {
  const response = await supabase
    .from("warranties")
    .select(warrantyRecordColumns)
    .eq("sale_id", saleId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (response.error) {
    logWarrantyPersistenceError(
      `${context}: could not check the existing warranty`,
      response.error
    );
  }

  return response;
}

async function persistWarrantyForSale({
  context = "Could not save warranty",
  endDate,
  months,
  notes,
  persistMonths = true,
  saleId,
  startDate,
  type,
  warrantyId = null,
}) {
  const normalizedSaleId = String(saleId ?? "").trim();
  const normalizedStartDate = getWarrantyDateValue(startDate);
  const normalizedEndDate = getWarrantyDateValue(endDate);

  if (!normalizedSaleId) {
    return {
      data: null,
      error: createWarrantyPersistenceError(
        "A sale record is required before adding a warranty.",
        "WARRANTY_SALE_REQUIRED"
      ),
    };
  }

  if (!normalizedStartDate || !normalizedEndDate) {
    return {
      data: null,
      error: createWarrantyPersistenceError(
        "A valid warranty start date and end date are required.",
        "WARRANTY_DATES_REQUIRED"
      ),
    };
  }

  const warrantyValues = createWarrantyRecordValues({
    endDate: normalizedEndDate,
    months,
    notes,
    persistMonths,
    saleId: normalizedSaleId,
    startDate: normalizedStartDate,
    type,
  });
  let existingWarrantyId = String(warrantyId ?? "").trim();

  if (!existingWarrantyId) {
    const existingResponse = await findLatestWarrantyForSale(
      normalizedSaleId,
      context
    );

    if (existingResponse.error) {
      return { data: null, error: existingResponse.error };
    }

    existingWarrantyId = existingResponse.data?.id ?? "";
  }

  const persistenceValues = prepareWarrantyRecordForPersistence(
    warrantyValues,
    { isUpdate: Boolean(existingWarrantyId) }
  );

  const response = existingWarrantyId
    ? await supabase
        .from("warranties")
        .update(persistenceValues)
        .eq("id", existingWarrantyId)
        .eq("sale_id", normalizedSaleId)
        .select(warrantyRecordColumns)
        .single()
    : await supabase
        .from("warranties")
        .insert([persistenceValues])
        .select(warrantyRecordColumns)
        .single();

  if (response.error) {
    logWarrantyPersistenceError(context, response.error);
  }

  return response;
}

export async function saveWarrantyForSale(options) {
  try {
    return await persistWarrantyForSale(options);
  } catch (error) {
    logWarrantyPersistenceError(
      options?.context ?? "Could not save warranty",
      error
    );
    return { data: null, error };
  }
}
