import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getCancellationAuditValues,
  isCancelledStatus,
} from "../src/lib/cancellation.js";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202608130001_cancellation_attribution.sql",
    import.meta.url
  ),
  "utf8"
).replace(/\s+/g, " ").toLowerCase();
const purchaseOrdersSource = readFileSync(
  new URL("../src/pages/PurchaseOrdersPage.jsx", import.meta.url),
  "utf8"
);
const purchaseOrderUtilsSource = readFileSync(
  new URL("../src/lib/purchaseOrderUtils.js", import.meta.url),
  "utf8"
);
const vehicleFileSource = readFileSync(
  new URL("../src/pages/VehicleFilePage.jsx", import.meta.url),
  "utf8"
);

test("recognizes both cancellation spellings and preserves existing attribution", () => {
  assert.equal(isCancelledStatus("cancelled"), true);
  assert.equal(isCancelledStatus("canceled"), true);
  assert.equal(isCancelledStatus("returned"), false);
  assert.match(
    purchaseOrderUtilsSource,
    /\["cancelled", "canceled"\]\.includes\(purchaseOrder\?\.status\)/
  );

  assert.deepEqual(
    getCancellationAuditValues(
      { status: "ordered" },
      "profile-1",
      "2026-08-10T21:45:00.000Z"
    ),
    {
      cancelled_at: "2026-08-10T21:45:00.000Z",
      cancelled_by: "profile-1",
    }
  );
  assert.deepEqual(
    getCancellationAuditValues(
      {
        cancelled_at: "2026-08-09T20:00:00.000Z",
        cancelled_by: "profile-old",
        status: "ordered",
      },
      "profile-new",
      "2026-08-10T21:45:00.000Z"
    ),
    {
      cancelled_at: "2026-08-09T20:00:00.000Z",
      cancelled_by: "profile-old",
    }
  );
  assert.deepEqual(
    getCancellationAuditValues(
      { status: "cancelled" },
      "profile-new",
      "2026-08-10T21:45:00.000Z"
    ),
    {}
  );
});

test("migration safely adds cancellation attribution without altering history", () => {
  for (const tableName of [
    "purchase_orders",
    "purchase_order_items",
    "part_requests",
  ]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${tableName} add column if not exists cancelled_by`)
    );
  }

  assert.doesNotMatch(migration, /delete from|truncate|drop column/);
});

test("PO cancellation writes and displays item, part, and order attribution", () => {
  assert.match(
    purchaseOrdersSource,
    /purchaseOrderCancellationValues/
  );
  assert.match(purchaseOrdersSource, /itemCancellationValues/);
  assert.match(purchaseOrdersSource, /partRequestCancellationValues/);
  assert.match(purchaseOrdersSource, /Cancelled by \$\{cancelledName\}/);
  assert.match(purchaseOrdersSource, /formatDateTime\(record\.cancelled_at\)/);
  assert.match(purchaseOrdersSource, /isPurchaseOrderItemReturned/);
  assert.match(purchaseOrdersSource, /returned_by/);
  assert.match(purchaseOrdersSource, /cancelled_by/);
});

test("Vehicle File cancellation activity has attributed and legacy fallbacks", () => {
  assert.match(vehicleFileSource, /const cancelledRecords =/);
  assert.match(vehicleFileSource, /"Cancelled",/);
  assert.match(
    vehicleFileSource,
    /getProfileName\(profiles, cancelledRecord\.cancelled_by\)/
  );
  assert.match(vehicleFileSource, /cancelledRecord\.cancelled_at/);
});
