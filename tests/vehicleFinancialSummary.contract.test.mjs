import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202608120001_correct_vehicle_financial_summary.sql",
    import.meta.url
  ),
  "utf8"
).replace(/\s+/g, " ").toLowerCase();
const dashboardSource = readFileSync(
  new URL("../src/pages/Dashboard.jsx", import.meta.url),
  "utf8"
);
const vehicleDetailSource = readFileSync(
  new URL("../src/pages/VehicleDetailPage.jsx", import.meta.url),
  "utf8"
);
const vehicleFileSource = readFileSync(
  new URL("../src/pages/VehicleFilePage.jsx", import.meta.url),
  "utf8"
);
const warrantyRegisterSource = readFileSync(
  new URL("../src/lib/warrantyRegister.js", import.meta.url),
  "utf8"
);

test("financial summary view excludes invalid parts and admits only ordered or received PO items", () => {
  assert.match(
    migration,
    /purchase_order_items\.status, ''\)\)\) in \('ordered', 'received'\)/
  );

  for (const status of ["cancelled", "canceled", "returned", "rejected"]) {
    assert.match(migration, new RegExp(`'${status}'`));
  }

  assert.match(migration, /part_requests\.part_source, ''\)\)\) <> 'in_house'/);
  assert.match(migration, /where public\.is_admin_or_manager\(\)/);
  assert.match(migration, /with \(security_invoker = true\)/);
});

test("financial total consumers use the corrected shared view", () => {
  for (const source of [
    dashboardSource,
    vehicleDetailSource,
    vehicleFileSource,
    warrantyRegisterSource,
  ]) {
    assert.match(source, /vehicle_financial_summary/);
    assert.doesNotMatch(source, /\.from\(["']vehicle_investment_summary["']\)/);
  }
});
