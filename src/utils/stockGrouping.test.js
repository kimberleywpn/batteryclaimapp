import test from "node:test";
import assert from "node:assert/strict";
import { groupStockByModel, isStockOnHand, stockBrand, stockMetadata } from "./stockGrouping.js";

test("cancelled intakes never count as on-hand or actual stock-out", () => {
  const items = ["available", "out", "cancelled"].map(state => ({ state }));
  assert.deepEqual(items.filter(isStockOnHand).map(item => item.state), ["available"]);
  assert.equal(items.filter(item => item.state === "out").length, 1);
});

test("battery model groups combine item-code variants while retaining individual batteries and brands", () => {
  const batteries = [
    { id: "1", sku: "bb-q85l", state: "available", model: "Q85L", brand: "AtlasBX" },
    { id: "2", sku: "DIFFERENT-CODE", state: "available", model: " q85l ", brand: "AtlasBX" },
    { id: "3", sku: "BC-Q85L", state: "available", model: "Q85L", brand: "MF Power" },
  ];
  const groups = groupStockByModel(batteries);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].model, "Q85L");
  assert.deepEqual(groups[0].items, batteries.slice(0, 2));
  assert.equal(groups[0].available, 2);
  assert.equal(groups[1].items[0].id, "3");
});

test("different models stay separate even with the same item code; missing models are not merged", () => {
  const groups = groupStockByModel([
    { sku: "SAME-CODE", model: "Q85L", brand: "AtlasBX", description: "EFB" },
    { sku: "SAME-CODE", model: "S95L", brand: "AtlasBX", description: "EFB" },
    { id: "unknown-1", brand: "AtlasBX" },
    { id: "unknown-2", brand: "AtlasBX" },
  ]);
  assert.equal(groups.length, 4);
  assert.equal(groups[0].model, "Q85L"); assert.equal(groups[1].model, "S95L");
  assert.deepEqual(groupStockByModel([]), []);
});

test("stock metadata keeps captured values and zero months when the claim changes", () => {
  const claims = new Map([["claim", { itemCode: "NEW", customer: "New Dealer", batteryUsedMonths: "99" }]]);
  const snapshot = { id: "claim", itemCode: "OLD", dealerName: "Original Dealer", batteryUsedMonths: "0", itemDescription: "Original Description" };
  const old = stockMetadata({ sourceClaim: snapshot, brand: "BB" }, claims);
  assert.equal(old.sku, "OLD"); assert.equal(old.usedMonths, "0");
  assert.equal(old.dealerName, "Original Dealer"); assert.equal(old.description, "Original Description");
  assert.equal(old.brand, "AtlasBX");
  const edited = stockMetadata({ sourceClaim: snapshot, sku: "EDITED", usedMonths: 0, dealerName: "", brand: "Bosch" }, claims);
  assert.equal(edited.sku, "EDITED"); assert.equal(edited.usedMonths, 0);
  assert.equal(edited.dealerName, ""); assert.equal(edited.brand, "Bosch");
  assert.equal(stockMetadata({ sourceClaim: { id: "claim" } }, claims).sku, "NEW");
  assert.equal(stockMetadata({}).sku, "");
  assert.equal(stockBrand("bc"), "MF Power");
});
