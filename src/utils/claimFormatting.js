export const titleCase = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const formatDisplayDate = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
};

export const shown = (value) =>
  value === undefined || value === null || value === ""
    ? "Not Recorded"
    : formatDisplayDate(value);

export const brandName = (value) => {
  const group = String(value || "").toUpperCase();
  if (group.startsWith("BB")) return "AtlasBX";
  if (group.startsWith("BC")) return "MF Power";
  if (group.startsWith("B")) return "Other Battery";
  return "Not Recorded";
};

export const stageLabel = (status) =>
  ({
    reported: "Collection",
    arrived: "Warehouse Inspecting",
    tested: "Warehouse Inspecting",
    admin: "Claim Processing",
    settlement: "Claim Processing",
    sales: "Sales Approval",
    complete: "Completed",
    cancelled: "Cancelled",
  })[status] || status || "Not Recorded";

export function completedMonthsBetween(invoiceDate, reportDate) {
  if (!invoiceDate || !reportDate) return "";
  const invoice = new Date(`${invoiceDate}T00:00:00Z`);
  const report = new Date(`${reportDate}T00:00:00Z`);
  if (!Number.isFinite(invoice.getTime()) || !Number.isFinite(report.getTime())) return "";
  const months =
    (report.getUTCFullYear() - invoice.getUTCFullYear()) * 12 +
    report.getUTCMonth() -
    invoice.getUTCMonth() -
    (report.getUTCDate() < invoice.getUTCDate() ? 1 : 0);
  return String(Math.max(0, months));
}

export function elapsedDays(from, to) {
  if (!from || !to) return "";
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? String(Math.round((end - start) / 86400000))
    : "";
}

export function mileageDifference(from, to) {
  const start = Number(from);
  const end = Number(to);
  return from !== "" && to !== "" && Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? end - start
    : "";
}

export function additionalMetrics(
  claim,
  admin = claim.admin || {},
  warehouse = claim.warehouse || {},
) {
  const claimDate = admin.claimDate || claim.claimDate || "";
  const usedPeriodDays = elapsedDays(admin.batteryInstalledDate, claimDate);
  const usedMileage = mileageDifference(admin.mileage1, admin.mileage2);
  return {
    claimDate,
    reportToBackDays: elapsedDays(
      claim.claimDate,
      warehouse.receivedDate || warehouse.inspectionDate,
    ),
    backToCheckedDays: elapsedDays(
      warehouse.receivedDate || warehouse.inspectionDate,
      warehouse.secondTestDate,
    ),
    usedPeriodDays,
    usedPeriodMonths:
      usedPeriodDays !== "" ? Math.floor(Number(usedPeriodDays) / 30) : "",
    usedMileage,
    orderToInstallDays: elapsedDays(claim.invoiceDate, admin.batteryInstalledDate),
    averageMileagePerDay:
      usedPeriodDays !== "" && Number(usedPeriodDays) > 0 && usedMileage !== ""
        ? (Number(usedMileage) / Number(usedPeriodDays)).toFixed(1)
        : "",
  };
}
