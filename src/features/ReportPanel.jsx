import { useEffect, useMemo, useState } from "react";
import { Alert, DatePicker, Modal, Table } from "antd";
import { Download, X } from "lucide-react";
import dayjs from "dayjs";
import { api } from "../api";
import { AppButton, AppPagination, CheckFilter, SearchInput } from "../components/AppControls";
import { additionalMetrics, brandName, shown, stageLabel, titleCase } from "../utils/claimFormatting";

const { RangePicker } = DatePicker;
const dateValue = (value) => (value ? dayjs(value) : null);

const reportColumns = [
  ["Case No.", "id"],
  ["Report Date", "claimDate"],
  ["Serial Number", "serial"],
  ["Invoice No.", "invoiceNo"],
  ["Invoice Date", "invoiceDate"],
  ["Battery Model", "model"],
  ["Brand", "brand"],
  ["Item Description", "itemDescription"],
  ["CRF No.", "crfNo"],
  ["Battery Used Months", "batteryUsedMonths"],
  ["Dealer / Customer", "dealer"],
  ["Branch Code", "branchName"],
  ["Area", "area"],
  ["Salesperson", "salesperson"],
  ["Claim Status", "status"],
  ["Date Received", "receivedDate"],
  ["Battery Batch / Code", "batchCode"],
  ["Production Date", "productDate"],
  ["Factory", "factory"],
  ["First Test Date", "firstTestDate"],
  ["Pre-Charge OCV (V)", "preOcv"],
  ["Pre-Charge CCA (A)", "preCca"],
  ["Second Test Date", "secondTestDate"],
  ["12 Hrs OCV (V)", "postOcv"],
  ["12 Hrs CCA (A)", "postCca"],
  ["Judgment Results", "judgment"],
  ["Hydrometer", "hydrometer"],
  ["Warehouse Result", "warehouseResult"],
  ["Battery Photos", "batteryPhotos"],
  ["Test-Result Photos", "testPhotos"],
  ["Result Review", "adminResult"],
  ["WAN No.", "wanNo"],
  ["Replace Item", "replaceItem"],
  ["Replace Serial No.", "replaceSerialNo"],
  ["Settle Date", "settleDate"],
  ["Pending With Reason", "pendingReason"],
];
const additionalColumns = [
  ["Claim Date", "additionalClaimDate"],
  ["Battery Installed Date", "batteryInstalledDate"],
  ["Car Model / Variant", "carModel"],
  ["Vehicle Registration Number", "vehicleRegistrationNo"],
  ["Vehicle Registration Date", "vehicleRegistrationDate"],
  ["Previous Installed Mileage", "mileage1"],
  ["Current Mileage", "mileage2"],
  ["Direct Replaced S/N", "directReplacedSerialNo"],
  ["Remarks", "remarks1"],
  ["Report To Back (Days)", "reportToBackDays"],
  ["Back To Checked (Days)", "backToCheckedDays"],
  ["Used Period (Days)", "usedPeriodDays"],
  ["Used Period (Months)", "usedPeriodMonths"],
  ["Used Mileage (Km)", "usedMileage"],
  ["Order To Install (Days)", "orderToInstallDays"],
  ["Average Mileage Per Day", "averageMileagePerDay"],
];
const approvalColumns = [
  ["Decision", "decision"],
  ["Approved By", "approvedBy"],
  ["Decision Date", "decisionDate"],
  ["Comments", "comments"],
];
function reportRecord(claim) {
  const warehouse = claim.warehouse || {},
    admin = claim.admin || {},
    approval = claim.approval || {},
    metrics = additionalMetrics(claim, admin, warehouse);
  return {
    ...claim,
    claimId: claim.id,
    id: claim.caseNumber || claim.id,
    brand: brandName(claim.itemGroup),
    dealer: claim.dealerName || claim.customer || "",
    status: stageLabel(claim.status),
    receivedDate: warehouse.receivedDate || warehouse.inspectionDate || "",
    batchCode: warehouse.batchCode || "",
    productDate: warehouse.productDate || "",
    factory: warehouse.factory || "",
    firstTestDate: warehouse.firstTestDate || "",
    preOcv: warehouse.preOcv || "",
    preCca: warehouse.preCca || "",
    secondTestDate: warehouse.secondTestDate || "",
    postOcv: warehouse.postOcv || "",
    postCca: warehouse.postCca || "",
    judgment: warehouse.judgment || "",
    hydrometer: warehouse.hydrometer || "",
    warehouseResult: warehouse.result || "",
    batteryPhotos: warehouse.batteryPhotoCount || 0,
    testPhotos: warehouse.testPhotoCount || 0,
    adminResult: titleCase(admin.result),
    wanNo: admin.wanNo || "",
    replaceItem: admin.replaceItem || admin.replaceBrand || "",
    replaceSerialNo: admin.replaceSerialNo || "",
    settleDate: admin.settleDate || "",
    pendingReason: admin.pendingReason || "",
    additionalClaimDate: metrics.claimDate,
    batteryInstalledDate: admin.batteryInstalledDate || "",
    carModel: admin.carModel || "",
    vehicleRegistrationNo: admin.vehicleRegistrationNo || "",
    vehicleRegistrationDate: admin.vehicleRegistrationDate || "",
    mileage1: admin.mileage1 || "",
    mileage2: admin.mileage2 || "",
    directReplacedSerialNo: admin.directReplacedSerialNo || "",
    remarks1: admin.remarks1 || "",
    ...metrics,
    claimDate: claim.claimDate || "",
    decision:
      approval.decision === "approved"
        ? "Approved"
        : approval.decision === "review_requested"
          ? "Review Requested"
          : "Pending Approval",
    approvedBy: approval.approvedBy || claim.salesperson || "",
    decisionDate: approval.decidedAt?.slice(0, 10) || "",
    comments: approval.comments || "",
  };
}
async function reportWorkbook(rows, columns) {
  const XLSX = await import("xlsx");
  const data = [
    columns.map(([label]) => label),
    ...rows.map((row) => columns.map(([, key]) => row[key] ?? "")),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = columns.map(([label, key]) => ({
    wch: Math.min(
      42,
      Math.max(
        label.length + 2,
        ...rows.slice(0, 250).map((row) => String(row[key] ?? "").length + 2),
      ),
    ),
  }));
  sheet["!autofilter"] = { ref: sheet["!ref"] };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "All Claims");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function downloadReport(rows, columns, name) {
  downloadBlob(
    new Blob([await reportWorkbook(rows, columns)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `battery-claims-${name}-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}
const zipCrcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function zipCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = zipCrcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function joinBytes(parts) {
  const result = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
function zipArchive(files) {
  const encoder = new TextEncoder(),
    locals = [],
    centrals = [];
  let offset = 0;
  const now = new Date(),
    time =
      (now.getHours() << 11) |
      (now.getMinutes() << 5) |
      (now.getSeconds() >> 1),
    date =
      ((now.getFullYear() - 1980) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate();
  for (const file of files) {
    const name = encoder.encode(file.name.replace(/\\/g, "/")),
      data = file.data,
      crc = zipCrc32(data),
      local = new Uint8Array(30 + name.length),
      lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    locals.push(local, data);
    const central = new Uint8Array(46 + name.length),
      cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const size = centrals.reduce((sum, part) => sum + part.length, 0),
    end = new Uint8Array(22),
    view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, files.length, true);
  view.setUint16(10, files.length, true);
  view.setUint32(12, size, true);
  view.setUint32(16, offset, true);
  return joinBytes([...locals, ...centrals, end]);
}
function base64Bytes(value) {
  const binary = atob(value),
    bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}
const filePart = (value) =>
  String(value || "file")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim()
    .slice(0, 100) || "file";
async function downloadPhotoReport(rows, setBusy) {
  setBusy(true);
  try {
    const files = [];
    for (const row of rows.filter(
      (item) => Number(item.batteryPhotos) + Number(item.testPhotos) > 0,
    )) {
      const photos = await api(
        `/api/claims/${encodeURIComponent(row.claimId)}/photos`,
      );
      for (const [kind, folder] of [
        ["battery", "Battery Photos"],
        ["test", "Test Result Photos"],
      ])
        for (const [index, photo] of (photos[kind] || []).entries()) {
          const ext =
            photo.type === "image/png"
              ? "png"
              : photo.type === "image/webp"
                ? "webp"
                : "jpg";
          files.push({
            name: `${folder}/${filePart(row.id)}_${filePart(row.serial)}_${kind}_${String(index + 1).padStart(2, "0")}.${ext}`,
            data: base64Bytes(photo.base64),
          });
        }
    }
    files.unshift({
      name: "Claims Report - Full Data.xlsx",
      data: new Uint8Array(
        await reportWorkbook(rows, [
          ...reportColumns,
          ...additionalColumns,
          ...approvalColumns,
        ]),
      ),
    });
    downloadBlob(
      new Blob([zipArchive(files)], { type: "application/zip" }),
      `battery-claims-with-photos-${new Date().toISOString().slice(0, 10)}.zip`,
    );
  } finally {
    setBusy(false);
  }
}
export default function ReportPanel({ claims, onClose }) {
  const rows = useMemo(() => claims.map(reportRecord), [claims]);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dealers, setDealers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [brands, setBrands] = useState([]);
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [exportError, setExportError] = useState("");
  const [salesOptions, setSalesOptions] = useState([]);
  const pageSize = 10;
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () =>
        api(
          `/api/dashboard-sales?${new URLSearchParams({ from, to, customer: "", agent: "" })}`,
        )
          .then((data) => {
            if (active) setSalesOptions(data.records || []);
          })
          .catch(() => {
            if (active) setSalesOptions([]);
          }),
      350,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [from, to]);
  const choiceRows = useMemo(
    () => [
      ...rows,
      ...salesOptions.map((record) => ({
        dealer: record.dealerName || record.customer || "",
        branchName: record.branchName || "",
        salesperson: record.salesperson || "",
        brand: brandName(record.itemGroup),
      })),
    ],
    [rows, salesOptions],
  );
  const options = (key) =>
    [...new Set(choiceRows.map((row) => row[key] || "Not Recorded"))]
      .sort()
      .map((value) => ({ value, label: value }));
  const dealerOptions = useMemo(() => {
    const groups = new Map();
    for (const row of choiceRows) {
      const dealer = row.dealer || "Not Recorded";
      const branch = row.branchName || "";
      if (!groups.has(dealer)) groups.set(dealer, new Map());
      groups.get(dealer).set(branch, `${dealer}|${branch}`);
    }
    return [...groups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dealer, branches]) =>
        branches.size === 1 && branches.has("")
          ? { label: dealer, value: branches.get("") }
          : {
              label: dealer,
              value: `dealer:${dealer}`,
              children: [...branches]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([branch, value]) => ({
                  label: branch || "No Branch",
                  value,
                })),
            },
      );
  }, [choiceRows]);
  const resultOptions = useMemo(
    () =>
      [...new Set(rows.map((row) => row.adminResult || "Not Recorded"))]
        .sort()
        .map((value) => ({ value, label: value })),
    [rows],
  );
  const filtered = rows.filter((row) => {
    const text = Object.values(row).join(" ").toLowerCase();
    return (
      (!query || text.includes(query.toLowerCase())) &&
      (!from || row.claimDate >= from) &&
      (!to || row.claimDate <= to) &&
      (!dealers.length ||
        dealers.includes(`${row.dealer}|${row.branchName || ""}`)) &&
      (!agents.length || agents.includes(row.salesperson || "Not Recorded")) &&
      (!brands.length || brands.includes(row.brand)) &&
      (!results.length || results.includes(row.adminResult || "Not Recorded"))
    );
  });
  useEffect(
    () => setPage(1),
    [query, from, to, dealers, agents, brands, results],
  );
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const clear = () => {
    setQuery("");
    setFrom("");
    setTo("");
    setDealers([]);
    setAgents([]);
    setBrands([]);
    setResults([]);
  };
  const tableColumns = reportColumns.map(([title, dataIndex]) => ({
    title,
    dataIndex,
    key: dataIndex,
    width:
      dataIndex === "itemDescription" || dataIndex === "dealer" ? 210 : 145,
    render: (value) => shown(value),
  }));
  return (
    <Modal
      className="report-modal"
      open
      footer={null}
      closable={false}
      width={1500}
      onCancel={() => !photoBusy && onClose()}
      mask={{ closable: !photoBusy }}
      destroyOnHidden
    >
      <section className="report-dialog">
        <AppButton
          className="sticky-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </AppButton>
        <div className="dialog-title">
          <span className="eyebrow">All Records</span>
          <h2>Claims Report</h2>
          <p>
            {filtered.length.toLocaleString()} of {rows.length.toLocaleString()}{" "}
            Records
          </p>
        </div>
        <div className="report-filters">
          <label className="report-search">
            Search
            <SearchInput
              className="app-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Serial, Dealer, Model, Result..."
              allowClear
            />
          </label>
          <label>
            Date Range
            <RangePicker
              className="report-range-picker"
              value={[dateValue(from), dateValue(to)]}
              onChange={(dates) => {
                setFrom(dates?.[0]?.format("YYYY-MM-DD") || "");
                setTo(dates?.[1]?.format("YYYY-MM-DD") || "");
              }}
              format="DD/MM/YYYY"
              placeholders={["Start Date", "End Date"]}
              allowClear
            />
          </label>
          <CheckFilter
            label="Dealer / Branch"
            options={dealerOptions}
            selected={dealers}
            onChange={setDealers}
          />
          <CheckFilter
            label="Sales Agent"
            options={options("salesperson")}
            selected={agents}
            onChange={setAgents}
          />
          <CheckFilter
            label="Brand"
            options={options("brand")}
            selected={brands}
            onChange={setBrands}
          />
          <CheckFilter
            label="Process Result"
            options={resultOptions}
            selected={results}
            onChange={setResults}
          />
          <AppButton className="clear-action" onClick={clear}>
            Clear Filters
          </AppButton>
        </div>
        <div className="report-table-wrap ant-report-table">
          <Table
            columns={tableColumns}
            dataSource={visible}
            rowKey="claimId"
            pagination={false}
            size="small"
            scroll={{ x: "max-content", y: 520 }}
            locale={{ emptyText: "No Matching Claims" }}
          />
        </div>
        <AppPagination
          page={page}
          total={filtered.length}
          pageSize={pageSize}
          onChange={setPage}
        />
        {exportError && (
          <Alert
            className="app-alert"
            type="error"
            showIcon
            message={exportError}
          />
        )}
        <div className="report-actions">
          <AppButton
            className="primary"
            icon={<Download size={17} />}
            onClick={() =>
              downloadReport(
                filtered,
                [...reportColumns, ...approvalColumns],
                "basic",
              )
            }
          >
            Export Basic
          </AppButton>
          <AppButton
            className="secondary"
            onClick={() =>
              downloadReport(
                filtered,
                [...reportColumns, ...additionalColumns, ...approvalColumns],
                "full",
              )
            }
          >
            Export Full Data
          </AppButton>
          <AppButton
            className="secondary"
            loading={photoBusy}
            icon={!photoBusy ? <Download size={17} /> : undefined}
            onClick={() => {
              setExportError("");
              downloadPhotoReport(filtered, setPhotoBusy).catch((error) =>
                setExportError(error.message),
              );
            }}
          >
            {photoBusy ? "Preparing Photos..." : "Export With Photos"}
          </AppButton>
        </div>
      </section>
    </Modal>
  );
}
