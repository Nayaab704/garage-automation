import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateVehicleFinancialSummary,
  calculateVehicleRepairCosts,
  getPartFinancialImpact,
} from "../src/lib/vehicleFinancials.js";

test("calculates the requested vehicle financial summary", () => {
  const summary = calculateVehicleFinancialSummary({
    vehicle: {
      purchase_price: 9400,
      target_sale_price: 19000,
    },
    partRequests: [
      {
        id: "in-house-valid",
        part_source: "in_house",
        quoted_total_cost: 100,
        status: "installed",
      },
      {
        id: "cancelled-part",
        part_source: "in_house",
        quoted_total_cost: 180,
        status: "cancelled",
      },
      {
        id: "purchased-valid",
        part_source: "needs_to_buy",
        status: "received",
      },
    ],
    purchaseOrderItems: [
      {
        id: "purchased-item",
        part_request_id: "purchased-valid",
        purchase_order_id: "valid-po",
        quantity: 2,
        shipping_cost: 20.43,
        status: "received",
        tax: 0,
        unit_cost: 100,
      },
    ],
    purchaseOrders: [{ id: "valid-po", status: "received" }],
    laborLogs: [{ labor_cost: 50 }],
    thirdPartyRepairs: [{ repair_cost: 30, transit_cost: 10 }],
    costEntries: [{ amount: 10 }],
  });

  assert.equal(summary.totalRepairCost, 420.43);
  assert.equal(summary.totalInvested, 9820.43);
  assert.equal(summary.targetSalePrice, 19000);
  assert.equal(summary.estimatedProfit, 9179.57);
});

test("excludes invalid parts, PO items, and cancelled purchase orders", () => {
  const repairCosts = calculateVehicleRepairCosts({
    partRequests: [
      {
        id: "canceled-spelling",
        part_source: "in_house",
        quoted_total_cost: 180,
        status: "canceled",
      },
      {
        approval_status: "rejected",
        id: "rejected-part",
        part_source: "in_house",
        quoted_total_cost: 180,
      },
      {
        id: "returned-part",
        part_source: "needs_to_buy",
        status: "returned",
      },
      {
        id: "valid-part-cancelled-po",
        part_source: "needs_to_buy",
        status: "ordered",
      },
      {
        id: "valid-part",
        part_source: "needs_to_buy",
        status: "received",
      },
    ],
    purchaseOrderItems: [
      {
        part_request_id: "returned-part",
        purchase_order_id: "valid-po",
        quantity: 1,
        status: "received",
        unit_cost: 180,
      },
      {
        part_request_id: "valid-part-cancelled-po",
        purchase_order_id: "cancelled-po",
        quantity: 1,
        status: "ordered",
        unit_cost: 180,
      },
      {
        part_request_id: "valid-part",
        purchase_order_id: "valid-po",
        quantity: 1,
        return_status: "returned",
        status: "received",
        unit_cost: 180,
      },
      {
        part_request_id: "valid-part",
        purchase_order_id: "valid-po",
        quantity: 1,
        status: "cancelled",
        unit_cost: 180,
      },
    ],
    purchaseOrders: [
      { id: "cancelled-po", status: "cancelled" },
      { id: "valid-po", status: "received" },
    ],
  });

  assert.equal(repairCosts.partsCost, 0);
  assert.equal(repairCosts.totalRepairCost, 0);
});

test("does not estimate profit when the target sale price is missing", () => {
  for (const targetSalePrice of [null, "", 0]) {
    const summary = calculateVehicleFinancialSummary({
      vehicle: { purchase_price: 9400, target_sale_price: targetSalePrice },
      costEntries: [{ amount: 420.43 }],
    });

    assert.equal(summary.targetSalePrice, null);
    assert.equal(summary.estimatedProfit, null);
  }
});

test("counts only the four ordered parts in the supplied cancelled-bumper scenario", () => {
  const partRequests = [
    ["headlight", "Right headlight", 132, "ordered"],
    ["outer-lights", "Outer tail lights", 118.86, "ordered"],
    ["inner-lights", "Inner tail lights", 103.27, "ordered"],
    ["fenders", "Left/right fender", 32.48, "ordered"],
    ["bumper", "Front bumper", 180, "cancelled"],
  ].map(([id, part_name, unit_cost, status]) => ({
    id,
    part_name,
    part_source: "needs_to_buy",
    status,
    unit_cost,
  }));
  const purchaseOrderItems = partRequests.map((partRequest) => ({
    id: `${partRequest.id}-item`,
    part_request_id: partRequest.id,
    purchase_order_id: `${partRequest.id}-po`,
    quantity: 1,
    status: partRequest.status,
    unit_cost: partRequest.unit_cost,
  }));
  const purchaseOrders = partRequests.map((partRequest) => ({
    id: `${partRequest.id}-po`,
    status: partRequest.status,
  }));
  const costs = calculateVehicleRepairCosts({
    partRequests,
    purchaseOrderItems,
    purchaseOrders,
  });
  const bumperImpact = getPartFinancialImpact({
    partRequest: partRequests.at(-1),
    purchaseOrder: purchaseOrders.at(-1),
    purchaseOrderItem: purchaseOrderItems.at(-1),
  });

  assert.ok(Math.abs(costs.purchasedPartsCost - 386.61) < 0.000001);
  assert.equal(costs.totalRepairCost, costs.purchasedPartsCost);
  assert.equal(bumperImpact.displayAmount, -180);
  assert.equal(bumperImpact.isExcluded, true);
  assert.equal(bumperImpact.statusImpact, "Excluded from totals");
});

test("counts in-house parts only as in-house and ignores unpurchased vendor parts", () => {
  const costs = calculateVehicleRepairCosts({
    partRequests: [
      {
        id: "in-house",
        part_source: "in_house",
        quoted_total_cost: 45,
        status: "installed",
      },
      {
        id: "pending-vendor",
        part_source: "needs_to_buy",
        status: "pending",
        quoted_total_cost: 70,
      },
    ],
    purchaseOrderItems: [
      {
        part_request_id: "in-house",
        purchase_order_id: "po",
        quantity: 1,
        status: "ordered",
        unit_cost: 45,
      },
      {
        part_request_id: "pending-vendor",
        purchase_order_id: "po",
        quantity: 1,
        status: "pending",
        unit_cost: 70,
      },
    ],
    purchaseOrders: [{ id: "po", status: "ordered" }],
  });

  assert.equal(costs.purchasedPartsCost, 0);
  assert.equal(costs.inHousePartsCost, 45);
  assert.equal(costs.partsCost, 45);
});
