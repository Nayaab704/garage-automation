import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getChunkedQueryRows,
  loadRelatedDatasets,
  partsQueueRelatedDataWarning,
} from "../src/lib/partsQueueLoading.js";

const partsQueueSource = readFileSync(
  new URL("../src/lib/partsQueue.js", import.meta.url),
  "utf8"
);
const partsPageSource = readFileSync(
  new URL("../src/pages/PartsPage.jsx", import.meta.url),
  "utf8"
);
const partsQueueCardSource = readFileSync(
  new URL("../src/components/parts/PartsQueueCard.jsx", import.meta.url),
  "utf8"
);
const partsQueueEmptyStateSource = readFileSync(
  new URL("../src/components/parts/PartsQueueEmptyState.jsx", import.meta.url),
  "utf8"
);

async function loadPartWorkflowUtils() {
  const source = readFileSync(
    new URL("../src/lib/partWorkflowUtils.js", import.meta.url),
    "utf8"
  )
    .replace(
      'from "./partReturns"',
      `from "${new URL("../src/lib/partReturns.js", import.meta.url).href}"`
    )
    .replace(
      'from "./searchText"',
      `from "${new URL("../src/lib/searchText.js", import.meta.url).href}"`
    );

  return import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
}

test("chunked related loads keep successful batches when one batch fails", async () => {
  const ids = Array.from({ length: 160 }, (_, index) => `id-${index}`);
  const seenBatchSizes = [];
  const temporaryError = { code: "PGRST400", message: "temporary failure" };
  const result = await getChunkedQueryRows(ids, async (batch) => {
    seenBatchSizes.push(batch.length);

    if (batch[0] === "id-75") {
      return { data: null, error: temporaryError };
    }

    return {
      data: batch.map((id) => ({ id })),
      error: null,
    };
  });

  assert.deepEqual(seenBatchSizes, [75, 75, 10]);
  assert.equal(result.data.length, 85);
  assert.equal(result.data[0].id, "id-0");
  assert.equal(result.data.at(-1).id, "id-159");
  assert.deepEqual(result.failures, [
    {
      batchNumber: 2,
      batchSize: 75,
      error: temporaryError,
      firstId: "id-75",
      lastId: "id-149",
    },
  ]);
});

test("related query failures return available data and detailed console errors", async () => {
  const originalConsoleError = console.error;
  const consoleErrors = [];
  console.error = (...args) => consoleErrors.push(args);

  try {
    const result = await loadRelatedDatasets([
      {
        key: "vehicles",
        label: "vehicles",
        load: async () => [{ id: "vehicle-1" }],
      },
      {
        key: "purchaseOrderItems",
        label: "purchase_order_items",
        load: async () => {
          throw { code: "57014", message: "query timed out" };
        },
      },
      {
        key: "quotes",
        label: "vendor_part_quotes",
        load: async () => ({
          data: [{ id: "quote-1" }],
          failures: [
            {
              batchNumber: 2,
              batchSize: 20,
              error: { code: "PGRST400", message: "temporary failure" },
              firstId: "part-76",
              lastId: "part-95",
            },
          ],
        }),
      },
    ]);

    assert.equal(result.hadFailures, true);
    assert.deepEqual(result.data.vehicles, [{ id: "vehicle-1" }]);
    assert.deepEqual(result.data.purchaseOrderItems, []);
    assert.deepEqual(result.data.quotes, [{ id: "quote-1" }]);
    assert.equal(consoleErrors.length, 2);
    assert.match(consoleErrors[0][0], /purchase_order_items/);
    assert.equal(consoleErrors[0][1].error.code, "57014");
    assert.match(consoleErrors[1][0], /vendor_part_quotes/);
    assert.equal(consoleErrors[1][1].batchNumber, 2);
    assert.equal(consoleErrors[1][1].error.code, "PGRST400");
  } finally {
    console.error = originalConsoleError;
  }
});

test("Parts Queue loads part_requests first and treats related tables as optional", () => {
  const mainQueryIndex = partsQueueSource.indexOf('.from("part_requests")');
  const relatedQueryIndex = partsQueueSource.indexOf(
    "const initialRelatedLoad = await loadRelatedDatasets"
  );

  assert.notEqual(mainQueryIndex, -1);
  assert.notEqual(relatedQueryIndex, -1);
  assert.ok(mainQueryIndex < relatedQueryIndex);
  assert.match(partsQueueSource, /if \(partRequestsResponse\.error\)/);
  assert.match(partsQueueSource, /getChunkedQueryRows\(partRequestIds/);

  for (const relation of [
    "purchase_order_items",
    "vendor_part_quotes",
    "vendors",
    "vehicles",
    "repair_jobs",
    "profiles",
  ]) {
    assert.match(partsQueueSource, new RegExp(relation));
  }

  assert.doesNotMatch(partsQueueSource, /firstRequiredError/);
  assert.equal(
    partsQueueRelatedDataWarning,
    "Some related details could not load. Refresh to try again."
  );
  assert.match(partsPageSource, /!errorMessage && relatedDataWarning/);
  assert.match(
    partsPageSource,
    /!errorMessage && filteredParts\.length > 0/
  );
});

test("tabs and filters still classify PO, returned, quote, and empty states", async () => {
  const {
    PART_QUEUE_TABS,
    filterPartsQueue,
    getPartQueueCounts,
    getPartQueueStatus,
    getSelectedVendorName,
  } = await loadPartWorkflowUtils();
  const parts = [
    {
      approval_status: "approved",
      id: "needs-po",
      part_name: "Front bumper",
      part_source: "needs_to_buy",
      purchaseOrderItems: [],
      selectedQuote: {
        display_vendor_name: "Acme Parts",
        vendor_id: "vendor-1",
        vendor_name_snapshot: "Acme Parts",
      },
      status: "requested",
      vehicle_id: "vehicle-1",
    },
    {
      approval_status: "approved",
      id: "ordered",
      part_name: "Mirror",
      part_source: "needs_to_buy",
      purchaseOrderItems: [
        {
          status: "ordered",
          purchaseOrder: { status: "ordered", vendor_id: "vendor-2" },
        },
      ],
      status: "ordered",
      vehicle_id: "vehicle-2",
    },
    {
      approval_status: "approved",
      id: "received",
      part_name: "Tire",
      part_source: "needs_to_buy",
      purchaseOrderItems: [
        { status: "received", purchaseOrder: { status: "received" } },
      ],
      status: "received",
      vehicle_id: "vehicle-3",
    },
    {
      approval_status: "approved",
      id: "returned",
      part_name: "Alternator",
      part_source: "needs_to_buy",
      purchaseOrderItems: [
        { return_status: "returned", status: "returned" },
      ],
      status: "returned",
      vehicle_id: "vehicle-4",
    },
    {
      approval_status: "not_required",
      id: "in-house",
      part_name: "Shop bolt",
      part_source: "in_house",
      purchaseOrderItems: [],
      status: "requested",
      vehicle_id: "vehicle-5",
    },
    {
      approval_status: "pending",
      id: "pending",
      part_name: "Headlamp",
      part_source: "needs_to_buy",
      purchaseOrderItems: [],
      repairJob: {
        category: "electrical",
        service_category_id: "category-1",
      },
      status: "requested",
      vehicle_id: "vehicle-6",
    },
  ];
  const counts = getPartQueueCounts(parts);

  assert.deepEqual(
    PART_QUEUE_TABS.map((tab) => tab.key),
    [
      "needs_po",
      "ordered",
      "received",
      "returned",
      "in_house",
      "pending_review",
      "all",
    ]
  );
  assert.deepEqual(counts, {
    all: 6,
    in_house: 1,
    needs_po: 2,
    ordered: 1,
    pending_review: 1,
    received: 1,
    returned: 1,
  });
  assert.equal(getPartQueueStatus(parts[1]), "ordered");
  assert.equal(getPartQueueStatus(parts[2]), "received");
  assert.equal(getPartQueueStatus(parts[3]), "returned");
  assert.equal(getSelectedVendorName(parts[0]), "Acme Parts");
  assert.deepEqual(
    filterPartsQueue(parts, { search: "Acme Parts", tab: "all" }).map(
      (part) => part.id
    ),
    ["needs-po"]
  );
  assert.deepEqual(
    filterPartsQueue(parts, {
      tab: "all",
      vendorId: "vendor-1",
    }).map((part) => part.id),
    ["needs-po"]
  );
  assert.deepEqual(
    filterPartsQueue(parts, {
      serviceCategoryId: "category-1",
      tab: "pending_review",
      vehicleId: "vehicle-6",
    }).map((part) => part.id),
    ["pending"]
  );

  assert.match(partsQueueCardSource, /PO:<\/span>/);
  assert.match(partsQueueCardSource, /Returned qty/);
  assert.match(partsQueueCardSource, /Selected vendor price is ready for PO\./);
  assert.match(partsQueueEmptyStateSource, /No parts found\./);
  assert.match(partsQueueEmptyStateSource, /No returned parts found\./);
  assert.match(partsQueueEmptyStateSource, /No matching records found\./);
});
