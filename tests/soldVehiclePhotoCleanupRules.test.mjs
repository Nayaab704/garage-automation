import assert from "node:assert/strict";
import test from "node:test";

import {
  getSoldVehiclePhotoCleanupPlan,
  normalizeVehiclePhotoStoragePath,
  SOLD_PHOTO_CLEANUP_WARNING,
} from "../src/lib/soldVehiclePhotoCleanupRules.js";

const vehicleId = "11111111-1111-4111-8111-111111111111";

test("sold cleanup recognizes direct and Supabase URL photo paths", () => {
  assert.equal(
    normalizeVehiclePhotoStoragePath(`vehicles/${vehicleId}/main photo.jpg`),
    `vehicles/${vehicleId}/main photo.jpg`
  );
  assert.equal(
    normalizeVehiclePhotoStoragePath(
      `https://example.supabase.co/storage/v1/object/public/vehicle-photos/vehicles/${vehicleId}/final%20photo.jpg`
    ),
    `vehicles/${vehicleId}/final photo.jpg`
  );
  assert.equal(
    normalizeVehiclePhotoStoragePath(
      `https://example.supabase.co/storage/v1/object/sign/vehicle-photos/vehicles/${vehicleId}/gallery.jpg?token=test`
    ),
    `vehicles/${vehicleId}/gallery.jpg`
  );
  assert.equal(
    normalizeVehiclePhotoStoragePath("https://images.example.com/photo.jpg"),
    ""
  );
});

test("sold cleanup plans every vehicle photo type without touching external files", () => {
  const plan = getSoldVehiclePhotoCleanupPlan({
    photos: [
      {
        id: "main-photo",
        photo_path: `vehicles/${vehicleId}/main.jpg`,
        photo_type: "main",
      },
      {
        id: "final-photo",
        photo_type: "final",
        photo_url: `https://example.supabase.co/storage/v1/object/public/vehicle-photos/vehicles/${vehicleId}/final.jpg`,
      },
      {
        id: "repair-photo",
        photo_path: `vehicles/${vehicleId}/work-orders/job-1/repair.jpg`,
        photo_type: "repair",
      },
      {
        id: "external-photo",
        photo_url: "https://images.example.com/listing.jpg",
      },
      {
        id: "unsafe-photo",
        photo_path: "vehicles/another-vehicle/photo.jpg",
      },
    ],
    vehicleId,
  });

  assert.equal(plan.photoCount, 5);
  assert.deepEqual(plan.databaseOnlyPhotoIds, ["external-photo"]);
  assert.deepEqual(plan.unsafePhotoIds, ["unsafe-photo"]);
  assert.deepEqual(plan.storagePaths.sort(), [
    `vehicles/${vehicleId}/final.jpg`,
    `vehicles/${vehicleId}/main.jpg`,
    `vehicles/${vehicleId}/work-orders/job-1/repair.jpg`,
  ]);
  assert.equal(SOLD_PHOTO_CLEANUP_WARNING, "Sale saved, but some photos may need cleanup.");
});

test("sold cleanup rejects decoded path traversal outside the vehicle folder", () => {
  const plan = getSoldVehiclePhotoCleanupPlan({
    photos: [
      {
        id: "traversal-photo",
        photo_path: `vehicles/${vehicleId}/%2e%2e/another-vehicle/photo.jpg`,
      },
    ],
    vehicleId,
  });

  assert.deepEqual(plan.storagePaths, []);
  assert.deepEqual(plan.unsafePhotoIds, ["traversal-photo"]);
});
