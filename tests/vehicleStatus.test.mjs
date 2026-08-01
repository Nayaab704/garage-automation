import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isVehicleSold,
  normalizeVehicleStatus,
} from "../src/lib/vehicleStatus.js";

test("sold display state does not alter the vehicle workflow status", () => {
  const readyVehicle = {
    sale_status: "available",
    status: "ready_for_sale",
  };

  assert.equal(isVehicleSold(readyVehicle), false);
  assert.equal(
    isVehicleSold({ ...readyVehicle, sale_status: "sold" }),
    true
  );
  assert.equal(isVehicleSold(readyVehicle, { id: "sale-1" }), true);
  assert.equal(isVehicleSold(readyVehicle, [{ id: "sale-1" }]), true);
  assert.equal(isVehicleSold({ status: "sold" }), true);
  assert.equal(normalizeVehicleStatus("sold"), "ready_for_sale");
});

test("all vehicle status display surfaces use the shared sold decision", () => {
  const displaySources = [
    "../src/components/VehicleCard.jsx",
    "../src/components/vehicle-detail/VehicleHeader.jsx",
    "../src/pages/VehicleFilePage.jsx",
    "../src/pages/MyWorkPage.jsx",
    "../src/pages/RepairsPage.jsx",
  ];

  for (const sourcePath of displaySources) {
    const source = readFileSync(new URL(sourcePath, import.meta.url), "utf8");
    assert.match(source, /isVehicleSold/);
  }

  const detailPageSource = readFileSync(
    new URL("../src/pages/VehicleDetailPage.jsx", import.meta.url),
    "utf8"
  );
  const headerSource = readFileSync(
    new URL(
      "../src/components/vehicle-detail/VehicleHeader.jsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(detailPageSource, /showBadge=\{false\}/);
  assert.match(headerSource, /canMarkSold && !isSold/);
});
