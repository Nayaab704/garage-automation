import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const cleanupMigration = readFileSync(
  new URL(
    "../supabase/migrations/202607270004_expired_warranty_delete_and_sales_summary.sql",
    import.meta.url
  ),
  "utf8"
);
const quoteRetentionMigration = readFileSync(
  new URL(
    "../supabase/migrations/202607300001_preserve_vendor_part_quote_history.sql",
    import.meta.url
  ),
  "utf8"
);
const selectedQuoteMigration = readFileSync(
  new URL(
    "../supabase/migrations/202606180001_part_request_selected_vendor_quote.sql",
    import.meta.url
  ),
  "utf8"
);
const rlsMigration = readFileSync(
  new URL(
    "../supabase/migrations/202607200002_phase1_rls.sql",
    import.meta.url
  ),
  "utf8"
);
const vendorSuggestionSource = readFileSync(
  new URL(
    "../src/components/vehicle-detail/VendorPriceSuggestions.jsx",
    import.meta.url
  ),
  "utf8"
);
const priceHistorySource = readFileSync(
  new URL(
    "../src/components/parts/PartPriceHistoryModal.jsx",
    import.meta.url
  ),
  "utf8"
);

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function getExpiredDeleteFunction(sql) {
  const signature =
    "create or replace function public.delete_expired_warranty_vehicle(";
  const functionStart = sql.indexOf(signature);
  const functionEnd = sql.indexOf("\n$$;", functionStart);

  assert.notEqual(
    functionStart,
    -1,
    "expired warranty delete function must exist"
  );
  assert.notEqual(
    functionEnd,
    -1,
    "expired warranty delete function must have a complete body"
  );

  return normalizeSql(sql.slice(functionStart, functionEnd));
}

test("expired vehicle cleanup deletes only vehicle-owned records", () => {
  const functionSql = getExpiredDeleteFunction(cleanupMigration);
  const vehicleOwnedTables = [
    "vehicle_documents",
    "purchase_order_items",
    "warranties",
    "vehicle_photos",
    "labor_logs",
    "cost_entries",
    "extra_costs",
    "activity_logs",
    "third_party_repairs",
    "purchase_orders",
    "part_requests",
    "repair_process_items",
    "repair_processes",
    "vehicle_prebookings",
    "sales",
    "repair_jobs",
    "vehicles",
  ];
  const protectedTables = [
    "vendor_part_quotes",
    "vendors",
    "vehicle_catalog_entries",
    "profiles",
    "vehicle_sales_monthly_summary",
  ];

  for (const tableName of vehicleOwnedTables) {
    assert.match(
      functionSql,
      new RegExp(`delete from public\\.${tableName}\\b`),
      `${tableName} must be deleted by expired vehicle cleanup`
    );
  }

  for (const tableName of protectedTables) {
    assert.doesNotMatch(
      functionSql,
      new RegExp(`delete from public\\.${tableName}\\b`),
      `${tableName} must survive expired vehicle cleanup`
    );
  }
});

test("expired vehicle cleanup detaches workflow links without changing quote ownership", () => {
  const functionSql = getExpiredDeleteFunction(cleanupMigration);
  const quoteUpdateStart = functionSql.indexOf(
    "update public.vendor_part_quotes"
  );
  const quoteUpdateEnd = functionSql.indexOf(
    "delete from public.vehicle_documents",
    quoteUpdateStart
  );
  const quoteUpdateSql = functionSql.slice(quoteUpdateStart, quoteUpdateEnd);
  const detachedColumns = [
    "vehicle_id",
    "repair_job_id",
    "part_request_id",
    "purchase_order_id",
    "purchase_order_item_id",
  ];

  assert.notEqual(
    quoteUpdateStart,
    -1,
    "cleanup must detach vendor quote workflow links"
  );

  for (const columnName of detachedColumns) {
    assert.match(
      quoteUpdateSql,
      new RegExp(`${columnName} = case .*? then null`),
      `${columnName} must be nulled when it belongs to the deleted vehicle`
    );
  }

  assert.doesNotMatch(
    quoteUpdateSql,
    /\bvendor_id\s*=/,
    "cleanup must keep the quote's reusable vendor link"
  );
  assert.doesNotMatch(
    quoteUpdateSql,
    /\b(raw_part_name|normalized_part_name|unit_price|notes|created_at)\s*=/,
    "cleanup must keep reusable quote suggestion fields"
  );
});

test("part request deletion uses SET NULL and never removes quote rows", () => {
  const migrationSql = normalizeSql(quoteRetentionMigration);

  assert.match(
    migrationSql,
    /alter column part_request_id drop not null/,
    "part_request_id must stay nullable"
  );
  assert.match(
    migrationSql,
    /foreign key \(part_request_id\) references public\.part_requests\(id\) on delete set null/,
    "part request deletion must detach quote history"
  );
  assert.doesNotMatch(
    migrationSql,
    /delete from public\.vendor_part_quotes\b/,
    "the retention migration must not delete quote history"
  );
});

test("manual quote deletion clears selections without deleting parts or vendors", () => {
  const migrationSql = normalizeSql(selectedQuoteMigration);
  const rlsSql = normalizeSql(rlsMigration);

  assert.match(
    migrationSql,
    /foreign key \(selected_quote_id\) references public\.vendor_part_quotes\(id\) on delete set null/,
    "deleting a quote must only clear the part request selection"
  );
  assert.doesNotMatch(
    migrationSql,
    /delete from public\.(part_requests|vendors)\b/,
    "quote cleanup must not delete parts or vendors"
  );
  assert.match(rlsSql, /'vendor_part_quotes'/);
  assert.match(
    rlsSql,
    /for delete to authenticated using \(public\.is_active_member\(\)\)/,
    "authenticated active members must retain manual quote cleanup support"
  );
  assert.match(
    rlsSql,
    /grant select, insert, update, delete on table public\.%i to authenticated/,
    "authenticated users need the table DELETE grant for the RLS policy"
  );
});

test("quote suggestion surfaces have a clean empty state", () => {
  const emptyState = "No previous vendor prices found.";

  assert.match(vendorSuggestionSource, new RegExp(emptyState));
  assert.match(priceHistorySource, new RegExp(emptyState));
});
