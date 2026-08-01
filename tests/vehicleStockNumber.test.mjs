import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  fetchNextVehicleStockNumber,
  isVehicleStockNumberConflict,
  nextVehicleStockNumberRpc,
  normalizeVehicleStockNumber,
} from "../src/lib/vehicleStockNumber.js";

const stockNumberMigration = readFileSync(
  new URL(
    "../supabase/migrations/202608010001_active_vehicle_stock_number_preview.sql",
    import.meta.url
  ),
  "utf8"
);
const originalStockNumberMigration = readFileSync(
  new URL(
    "../supabase/migrations/202607080001_vehicle_stock_number_sequence.sql",
    import.meta.url
  ),
  "utf8"
);
const intakeFormSource = readFileSync(
  new URL("../src/components/AddVehicleForm.jsx", import.meta.url),
  "utf8"
);

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function getSqlFunction(sql, signature) {
  const functionStart = sql.indexOf(signature);
  const functionEnd = sql.indexOf("\n$$;", functionStart);

  assert.notEqual(functionStart, -1, `${signature} must exist`);
  assert.notEqual(functionEnd, -1, `${signature} must have a complete body`);

  return normalizeSql(sql.slice(functionStart, functionEnd));
}

test("stock number preview normalizes the database helper result", async () => {
  let calledFunction = "";
  const supabaseClient = {
    rpc: async (functionName) => {
      calledFunction = functionName;
      return { data: " stk-3 ", error: null };
    },
  };

  const result = await fetchNextVehicleStockNumber(supabaseClient);

  assert.equal(calledFunction, nextVehicleStockNumberRpc);
  assert.deepEqual(result, { data: "STK-3", error: null });
  assert.equal(normalizeVehicleStockNumber("STK-1"), "STK-1");
  assert.equal(normalizeVehicleStockNumber("STK-0"), "");
  assert.equal(normalizeVehicleStockNumber("ARCHIVE-4"), "");
});

test("stock number preview fails closed and detects allocation conflicts", async () => {
  const invalidResult = await fetchNextVehicleStockNumber({
    rpc: async () => ({ data: "", error: null }),
  });
  const queryError = { code: "42501", message: "Not allowed" };
  const errorResult = await fetchNextVehicleStockNumber({
    rpc: async () => ({ data: null, error: queryError }),
  });

  assert.equal(invalidResult.data, "");
  assert.ok(invalidResult.error instanceof Error);
  assert.deepEqual(errorResult, { data: "", error: queryError });
  assert.equal(
    isVehicleStockNumberConflict({
      code: "23505",
      constraint: "vehicles_stock_number_unique_idx",
    }),
    true
  );
  assert.equal(
    isVehicleStockNumberConflict({ code: "23505", message: "VIN duplicate" }),
    false
  );
});

test("preview and automatic save share the live-vehicles allocator", () => {
  const nextNumberFunction = getSqlFunction(
    stockNumberMigration,
    "create or replace function public.get_next_vehicle_stock_number()"
  );
  const generatorFunction = getSqlFunction(
    stockNumberMigration,
    "create or replace function public.generate_vehicle_stock_number()"
  );
  const insertTriggerFunction = getSqlFunction(
    stockNumberMigration,
    "create or replace function public.set_vehicle_stock_number()"
  );

  assert.match(nextNumberFunction, /from public\.vehicles\b/);
  assert.match(nextNumberFunction, /coalesce\( max\( .*?, 0 \) \+ 1/);
  assert.doesNotMatch(
    nextNumberFunction,
    /vehicle_archive_records|vendor_part_quotes|stock_number_snapshot/
  );
  assert.match(
    generatorFunction,
    /return public\.get_next_vehicle_stock_number\(\)/
  );
  assert.match(insertTriggerFunction, /pg_advisory_xact_lock/);
  assert.match(
    insertTriggerFunction,
    /new\.stock_number := public\.get_next_vehicle_stock_number\(\)/
  );
  assert.match(
    normalizeSql(originalStockNumberMigration),
    /alter column stock_number set default public\.generate_vehicle_stock_number\(\)/
  );
  assert.match(
    normalizeSql(originalStockNumberMigration),
    /execute function public\.set_vehicle_stock_number\(\)/
  );
  assert.match(
    normalizeSql(originalStockNumberMigration),
    /create unique index if not exists vehicles_stock_number_unique_idx/
  );
  assert.match(intakeFormSource, /fetchNextVehicleStockNumber\(supabase\)/);
  assert.match(
    intakeFormSource,
    /buildVehiclePayload\(formData, nextStockNumber\)/
  );
  assert.match(
    intakeFormSource,
    /\{ stock_number: normalizedStockNumber \}/
  );
});
