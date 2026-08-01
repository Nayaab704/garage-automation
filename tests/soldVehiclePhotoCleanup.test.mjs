import assert from "node:assert/strict";
import test from "node:test";

import { cleanupSoldVehiclePhotosWithClient } from "../src/lib/soldVehiclePhotoCleanup.js";
import { SOLD_PHOTO_CLEANUP_WARNING } from "../src/lib/soldVehiclePhotoCleanupRules.js";

const vehicleId = "11111111-1111-4111-8111-111111111111";
const saleId = "22222222-2222-4222-8222-222222222222";
const repairJobId = "33333333-3333-4333-8333-333333333333";

function createFakeClient({ failDatabaseDelete = false, failedStoragePaths = [] } = {}) {
  const events = [];
  const failedPaths = new Set(failedStoragePaths);
  const tables = {
    repair_jobs: [{ id: repairJobId, vehicle_id: vehicleId }],
    sales: [{ id: saleId, vehicle_id: vehicleId }],
    vehicle_photos: [
      {
        id: "main-photo",
        photo_path: `vehicles/${vehicleId}/main.jpg`,
        repair_job_id: null,
        vehicle_id: vehicleId,
      },
      {
        id: "repair-photo",
        photo_path: `vehicles/${vehicleId}/work-orders/${repairJobId}/repair.jpg`,
        repair_job_id: repairJobId,
        vehicle_id: null,
      },
    ],
    vehicles: [
      {
        id: vehicleId,
        primary_photo_id: "main-photo",
        sale_status: "sold",
      },
    ],
  };
  const storedPaths = new Set(
    tables.vehicle_photos.map((photo) => photo.photo_path)
  );

  function matchesFilters(row, filters) {
    return filters.every((filter) => {
      if (filter.type === "eq") {
        return row?.[filter.column] === filter.value;
      }

      return filter.values.includes(row?.[filter.column]);
    });
  }

  class QueryBuilder {
    constructor(tableName) {
      this.tableName = tableName;
      this.filters = [];
      this.operation = "select";
      this.updateValues = null;
    }

    delete() {
      this.operation = "delete";
      return this;
    }

    eq(column, value) {
      this.filters.push({ column, type: "eq", value });
      return this;
    }

    in(column, values) {
      this.filters.push({ column, type: "in", values });
      return this;
    }

    maybeSingle() {
      return this.execute(true);
    }

    select() {
      return this;
    }

    then(resolve, reject) {
      return this.execute(false).then(resolve, reject);
    }

    update(values) {
      this.operation = "update";
      this.updateValues = values;
      return this;
    }

    async execute(single) {
      events.push(`${this.operation}:${this.tableName}`);
      const currentRows = tables[this.tableName] ?? [];
      const matchedRows = currentRows.filter((row) =>
        matchesFilters(row, this.filters)
      );

      if (this.operation === "update") {
        for (const row of matchedRows) {
          Object.assign(row, this.updateValues);
        }
      }

      if (this.operation === "delete") {
        if (failDatabaseDelete) {
          return { data: null, error: new Error("database delete failed") };
        }

        const deletedIds = new Set(matchedRows.map((row) => row.id));
        tables[this.tableName] = currentRows.filter(
          (row) => !deletedIds.has(row.id)
        );
      }

      return {
        data: single ? matchedRows[0] ?? null : matchedRows,
        error: null,
      };
    }
  }

  return {
    client: {
      from(tableName) {
        return new QueryBuilder(tableName);
      },
      storage: {
        from(bucketName) {
          assert.equal(bucketName, "vehicle-photos");

          return {
            async remove(paths) {
              events.push("storage:vehicle-photos:remove");

              if (paths.some((path) => failedPaths.has(path))) {
                return { data: null, error: new Error("storage delete failed") };
              }

              for (const path of paths) {
                storedPaths.delete(path);
              }

              return { data: [], error: null };
            },
          };
        },
      },
    },
    events,
    storedPaths,
    tables,
  };
}

test("sold cleanup collects paths, clears primary, removes storage, then deletes rows", async () => {
  const fake = createFakeClient();
  const result = await cleanupSoldVehiclePhotosWithClient({
    client: fake.client,
    saleId,
    vehicleId,
  });

  assert.equal(result.completed, true);
  assert.equal(result.warning, "");
  assert.equal(result.deletedCount, 2);
  assert.equal(fake.tables.vehicle_photos.length, 0);
  assert.equal(fake.tables.vehicles[0].primary_photo_id, null);
  assert.equal(fake.tables.sales.length, 1);
  assert.equal(fake.storedPaths.size, 0);

  const collectedIndex = fake.events.indexOf("select:vehicle_photos");
  const primaryClearedIndex = fake.events.indexOf("update:vehicles");
  const storageRemovedIndex = fake.events.indexOf(
    "storage:vehicle-photos:remove"
  );
  const photoRowsDeletedIndex = fake.events.indexOf("delete:vehicle_photos");

  assert.ok(collectedIndex >= 0);
  assert.ok(primaryClearedIndex > collectedIndex);
  assert.ok(storageRemovedIndex > primaryClearedIndex);
  assert.ok(photoRowsDeletedIndex > storageRemovedIndex);
});

test("partial storage cleanup resolves with a warning and keeps the sale", async () => {
  const failedPath = `vehicles/${vehicleId}/main.jpg`;
  const fake = createFakeClient({ failedStoragePaths: [failedPath] });
  const result = await cleanupSoldVehiclePhotosWithClient({
    client: fake.client,
    saleId,
    vehicleId,
  });

  assert.equal(result.completed, false);
  assert.equal(result.warning, SOLD_PHOTO_CLEANUP_WARNING);
  assert.equal(result.failedCount, 1);
  assert.deepEqual(
    fake.tables.vehicle_photos.map((photo) => photo.id),
    ["main-photo"]
  );
  assert.equal(fake.tables.sales.length, 1);
  assert.equal(fake.tables.vehicles[0].sale_status, "sold");
  assert.equal(fake.storedPaths.has(failedPath), true);
});

test("database cleanup failure never rejects or removes protected sale data", async () => {
  const fake = createFakeClient({ failDatabaseDelete: true });
  const result = await cleanupSoldVehiclePhotosWithClient({
    client: fake.client,
    saleId,
    vehicleId,
  });

  assert.equal(result.completed, false);
  assert.equal(result.warning, SOLD_PHOTO_CLEANUP_WARNING);
  assert.equal(result.failedCount, 2);
  assert.equal(fake.tables.vehicle_photos.length, 2);
  assert.equal(fake.tables.sales.length, 1);
  assert.equal(fake.tables.vehicles[0].sale_status, "sold");
  assert.equal(fake.storedPaths.size, 0);
  assert.deepEqual(
    [...new Set(fake.events.map((event) => event.split(":")[1]))]
      .filter(Boolean)
      .sort(),
    ["repair_jobs", "sales", "vehicle-photos", "vehicle_photos", "vehicles"]
  );
});
