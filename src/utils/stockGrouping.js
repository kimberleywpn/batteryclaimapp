import { brandName } from "./claimFormatting.js";

export const isStockOnHand = item => item.state === "available";

export function stockBrand(value) {
  const text = String(value || "").trim();
  return /^(BB|BC)|^B$/i.test(text) ? brandName(text.toUpperCase()) : text;
}

export function stockMetadata(item, claimsById = new Map()) {
  const source = item.sourceClaim || {};
  const claim = claimsById.get(source.id) || {};
  return {
    ...item,
    sku: item.sku ?? source.itemCode ?? claim.itemCode ?? "",
    description: item.description ?? source.itemDescription ?? claim.itemDescription ?? "",
    brand: stockBrand(item.brand || claim.itemGroup),
    usedMonths: item.usedMonths ?? source.batteryUsedMonths ?? claim.batteryUsedMonths ?? "",
    dealerName: item.dealerName ?? source.dealerName ?? claim.customer ?? claim.dealerName ?? "",
    branchName: item.branchName ?? source.branchName ?? claim.branchName ?? "",
  };
}

export function groupStockByModel(items) {
  const groups = new Map();
  const normalized = value => String(value || "").trim().toUpperCase();
  for (const item of items) {
    const model = String(item.model || "").trim().replace(/\s+/g, " ");
    // Keep brands separate while combining item-code variants of one model.
    const key = model ? JSON.stringify([normalized(item.brand), normalized(model)]) : JSON.stringify(["unknown", normalized(item.brand), item.id || item.serial]);
    if (!groups.has(key)) groups.set(key, { key, brand: item.brand, description: item.description, model, items: [], available: 0 });
    const group = groups.get(key);
    if (!group.description && item.description) group.description = item.description;
    group.items.push(item);
    if (item.state === "available") group.available += 1;
  }
  return [...groups.values()];
}
