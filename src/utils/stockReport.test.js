import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { filterStockRecords, stockReportSheets, stockReportWorkbook } from "./stockReport.js";

const battery = { id: "stock-1", serial: "00123", model: "Q85L", brand: "AtlasBX", state: "available", receivedDate: "2026-10-01", usedMonths: 0, ocv: "12.80", cca: 0, dealerName: "=HYPERLINK(\"bad\")", branchName: "0001", sourceClaim: { serial: "00099", id: "claim-1", caseNumber: "C001" } };
const options = { view: "in", rows: [battery], items: [battery], generatedAt: "29-10-2026 23:00:00", generatedBy: "QA", query: "Q85L", brand: "AtlasBX", startDate: "2026-10-01" };

test("stock and report filters share inclusive date bounds and the selected movement date basis", () => {
  const sold = { ...battery, id: "out", state: "out", receivedDate: "2026-09-01", out: { date: "2026-10-28" } };
  const cancelled = { ...battery, id: "cancelled", state: "cancelled", cancellation: { date: "2026-10-29" } };
  const items = [battery, sold, cancelled];
  const movement = { itemId: sold.id, serial: sold.serial, model: sold.model, date: "2026-10-28" };
  const base = { items, movements: [movement], brand: "AtlasBX", query: "0001" };
  assert.deepEqual(filterStockRecords({ ...base, view: "in", startDate: "2026-10-01", endDate: "2026-10-01" }), [battery]);
  assert.deepEqual(filterStockRecords({ ...base, view: "out", startDate: "2026-10-28", endDate: "2026-10-28" }), [sold]);
  assert.deepEqual(filterStockRecords({ ...base, view: "cancelled", startDate: "2026-10-29" }), [cancelled]);
  assert.deepEqual(filterStockRecords({ ...base, view: "movements", startDate: "2026-10-28", endDate: "2026-10-28" }), [movement]);
  assert.deepEqual(filterStockRecords({ ...base, view: "movements", startDate: "2026-10-29" }), []);
  assert.deepEqual(filterStockRecords({ ...base, view: "in", brand: "Other" }), []);
});

test("stock export includes every supplied battery and reconciles model quantities", () => {
  const rows = Array.from({ length: 25 }, (_, index) => ({ ...battery, id: `stock-${index}`, serial: String(index), brand: index === 24 ? "Other" : "AtlasBX" }));
  const sheets = stockReportSheets({ ...options, rows });
  assert.deepEqual(sheets.map(sheet => sheet.name), ["Summary", "Stock By Model", "Batteries"]);
  assert.equal(sheets[2].rows.length, 26);
  assert.deepEqual(sheets[1].rows.slice(1).map(row => row[3]), [24, 1]);
  const summary = new Map(sheets[0].rows);
  assert.equal(summary.get("Batteries"), 25); assert.equal(summary.get("Brand / Model Groups"), 2);
  assert.equal(summary.get("Search"), "Q85L"); assert.equal(summary.get("Date Filter Uses"), "Stock-In Date");
});

test("xlsx roundtrip preserves dates, zeros, serial text and formula-like user text", async () => {
  const data = await stockReportWorkbook(options);
  const book = XLSX.read(data, { type: "array", cellNF: true });
  const sheet = book.Sheets.Batteries;
  assert.equal(sheet.A2.v, "00099"); assert.equal(sheet.A2.t, "s");
  assert.equal(sheet.F2.z, "dd-mm-yyyy"); assert.equal(sheet.F2.w, "01-10-2026");
  assert.equal(sheet.G2.v, 0); assert.equal(sheet.H2.v, 12.8); assert.equal(sheet.I2.v, 0);
  assert.equal(sheet.L2.v, battery.dealerName); assert.equal(sheet.L2.t, "s"); assert.equal(sheet.L2.f, undefined);
  assert.equal(sheet.M2.v, "0001"); assert.equal(sheet.K2.v, "");
  assert.ok(sheet["!autofilter"]); assert.equal(book.Sheets.Summary["!autofilter"], undefined);
  assert.ok(!XLSX.utils.sheet_to_json(sheet, { header: 1 })[0].some(label => /location|sku/i.test(label)));
});

test("out, cancellation and movements retain purpose, references, reasons and effective dates", () => {
  const out = { ...battery, state: "out", out: { type: "sold", date: "2026-10-28", price: 0, recipient: "Buyer", reference: "0007", remarks: "Sold" } };
  const outSheets = stockReportSheets({ ...options, view: "out", rows: [out] });
  assert.equal(new Map(outSheets[0].rows).get("Date Filter Uses"), "Stock-Out Date");
  const row = Object.fromEntries(outSheets[2].rows[0].map((label, index) => [label, outSheets[2].rows[1][index]]));
  assert.equal(row["Stock-Out Type"], "Sold"); assert.equal(row["Selling Price (MYR)"], 0); assert.equal(row.Reference, "0007");
  const cancelled = { ...battery, state: "cancelled", cancellation: { date: "2026-10-29", reason: "Mistake" } };
  const cancelSheet = stockReportSheets({ ...options, view: "cancelled", rows: [cancelled] })[2];
  assert.equal(cancelSheet.rows[1][21], "Mistake");
  const event = { id: "m1", itemId: battery.id, kind: "sold", serial: battery.serial, model: battery.model, actor: "Admin", date: "2026-10-28", recordedAt: "2026-10-28T12:00:00Z", details: out.out };
  const sheets = stockReportSheets({ ...options, view: "movements", rows: [event] });
  assert.deepEqual(sheets.map(sheet => sheet.name), ["Summary", "Movements"]);
  assert.equal(new Map(sheets[0].rows).get("Date Filter Uses"), "Movement Date");
  assert.equal(sheets[1].rows[1][5], "AtlasBX"); assert.equal(sheets[1].rows[1][9], 0);
});
