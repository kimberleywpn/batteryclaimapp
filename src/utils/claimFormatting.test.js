import test from "node:test";
import assert from "node:assert/strict";
import {
  additionalMetrics,
  brandName,
  completedMonthsBetween,
  elapsedDays,
  formatDisplayDate,
  mileageDifference,
  shown,
  stageLabel,
  titleCase,
} from "./claimFormatting.js";

test("formats display values consistently", () => {
  assert.equal(titleCase("COMPENSATION OF CLAIMS"), "Compensation Of Claims");
  assert.equal(shown(""), "Not Recorded");
  assert.equal(shown(0), 0);
  assert.equal(shown("2026-09-15"), "15-09-2026");
  assert.equal(formatDisplayDate("not-a-date"), "not-a-date");
  assert.equal(brandName("BB01"), "AtlasBX");
  assert.equal(brandName("BC01"), "MF Power");
  assert.equal(stageLabel("settlement"), "Claim Processing");
});

test("calculates completed battery-use months", () => {
  assert.equal(completedMonthsBetween("2025-01-15", "2026-03-15"), "14");
  assert.equal(completedMonthsBetween("2025-01-15", "2026-03-14"), "13");
  assert.equal(completedMonthsBetween("2026-03-15", "2025-01-15"), "0");
  assert.equal(completedMonthsBetween("", "2026-03-15"), "");
});

test("calculates report metrics without negative values", () => {
  assert.equal(elapsedDays("2026-09-01", "2026-09-11"), "10");
  assert.equal(elapsedDays("2026-09-11", "2026-09-01"), "");
  assert.equal(mileageDifference("1000", "1450"), 450);
  assert.equal(mileageDifference("1450", "1000"), "");

  const metrics = additionalMetrics(
    { claimDate: "2026-09-01", invoiceDate: "2026-01-01" },
    {
      batteryInstalledDate: "2026-08-02",
      mileage1: "1000",
      mileage2: "1450",
    },
    { receivedDate: "2026-09-03", secondTestDate: "2026-09-05" },
  );
  assert.deepEqual(metrics, {
    claimDate: "2026-09-01",
    reportToBackDays: "2",
    backToCheckedDays: "2",
    usedPeriodDays: "30",
    usedPeriodMonths: 1,
    usedMileage: 450,
    orderToInstallDays: "213",
    averageMileagePerDay: "15.0",
  });
});
