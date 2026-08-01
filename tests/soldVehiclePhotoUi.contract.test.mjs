import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readSource(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const cleanupSource = readSource("../src/lib/soldVehiclePhotoCleanup.js");
const cleanupRulesSource = readSource(
  "../src/lib/soldVehiclePhotoCleanupRules.js"
);
const sellFormSource = readSource(
  "../src/components/vehicle-detail/SellVehicleForm.jsx"
);
const vehicleCardSource = readSource("../src/components/VehicleCard.jsx");
const vehicleDetailSource = readSource("../src/pages/VehicleDetailPage.jsx");
const vehicleFileSource = readSource("../src/pages/VehicleFilePage.jsx");
const vehicleHeaderSource = readSource(
  "../src/components/vehicle-detail/VehicleHeader.jsx"
);

test("sold photo cleanup is storage API only and leaves protected business data alone", () => {
  assert.match(
    cleanupSource,
    /\.storage\s*\.from\(VEHICLE_PHOTO_BUCKET\)\s*\.remove\(\[storagePath\]\)/
  );
  assert.doesNotMatch(cleanupSource, /storage\.objects/);

  for (const protectedTable of [
    "vehicle_documents",
    "vehicle_sales_monthly_summary",
    "vendor_part_quotes",
    "vendors",
    "profiles",
    "vehicle_catalog_entries",
    "warranties",
  ]) {
    assert.doesNotMatch(
      cleanupSource,
      new RegExp(`\\.from\\(["']${protectedTable}["']\\)`)
    );
  }
});

test("sale flow awaits photo cleanup before its warranty save branch", () => {
  const newSaleCleanupIndex = sellFormSource.indexOf(
    "const photoCleanup = await getSoldPhotoCleanup(saleId);"
  );
  const warrantySaveIndex = sellFormSource.indexOf(
    "if (hasWarrantyDetails(formData) && saleId)",
    newSaleCleanupIndex
  );

  assert.ok(newSaleCleanupIndex >= 0);
  assert.ok(warrantySaveIndex > newSaleCleanupIndex);
  assert.match(sellFormSource, /existingSaleResponse\.data\.id[\s\S]*getSoldPhotoCleanup/);
  assert.match(cleanupRulesSource, /Sale saved, but some photos may need cleanup\./);
});

test("sold vehicle surfaces clear local photos and force placeholders", () => {
  assert.match(vehicleDetailSource, /setVehiclePhotos\(\[\]\)/);
  assert.match(vehicleDetailSource, /result\?\.photoCleanup\?\.warning/);
  assert.match(vehicleDetailSource, /canManagePhotos && !isVehicleSold/);
  assert.match(
    vehicleDetailSource,
    /hasPermission\(role, "vehicle:delete"\) && !isVehicleSold/
  );
  assert.match(vehicleDetailSource, /primary_photo_id: null/);

  assert.match(vehicleFileSource, /photos: \[\]/);
  assert.match(vehicleFileSource, /result\?\.photoCleanup\?\.warning/);
  assert.match(vehicleFileSource, /primary_photo_id: null/);
  assert.match(vehicleFileSource, /isVehicleSoldRecord \? \[\] : data\?\.photos/);

  assert.match(vehicleCardSource, /photo=\{sold \? null : photo\}/);
  assert.match(vehicleHeaderSource, /isSold \? "" : primaryPhoto\?\.photo_url/);
  assert.match(vehicleFileSource, /photoUrl = isSold \? "" : photo\?\.photo_url/);
  assert.match(vehicleCardSource, /onError=\{\(\) => setFailedPhotoUrl/);
  assert.match(vehicleHeaderSource, /onError=\{\(\) => setFailedThumbnailUrl/);
  assert.match(vehicleFileSource, /onError=\{\(\) => setFailedPhotoUrl/);
});
