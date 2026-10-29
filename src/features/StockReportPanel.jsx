import { useMemo, useState } from "react";
import { Alert, Input, Modal, Select, Table, message } from "antd";
import { Download, Search } from "lucide-react";
import dayjs from "dayjs";
import { AppButton, AppPagination, RangePicker } from "../components/AppControls";
import { downloadStockReport, filterStockRecords, stockReportSheets, stockViews } from "../utils/stockReport";

const displayCell = value => {
  if (value && typeof value === "object" && value.t === "n") {
    return dayjs(new Date((value.v - 25569) * 86400000).toISOString().slice(0, 10)).format("DD-MM-YYYY");
  }
  return value === "" || value == null ? "-" : String(value);
};

export default function StockReportPanel({ items, movements, session, initialFilters, error, onClose }) {
  const [filters, setFilters] = useState(() => ({ ...initialFilters }));
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false), [exportError, setExportError] = useState("");
  const change = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); setExportError(""); };
  const filtered = useMemo(() => filterStockRecords({ items, movements, ...filters }), [items, movements, filters]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 10)));
  const movementView = filters.view === "movements";
  const preview = useMemo(() => {
    const sheets = stockReportSheets({ items, ...filters, rows: filtered.slice((currentPage - 1) * 10, currentPage * 10) });
    const sheet = sheets.at(-1);
    const indexes = movementView ? [0, 3, 4, 2, 6, 7] : [0, 1, 5, 6, 7, 8, ...(filters.view === "out" ? [14, 15] : filters.view === "cancelled" ? [20] : [])];
    return {
      columns: indexes.map(index => ({ title: sheet.rows[0][index], dataIndex: String(index), key: String(index), width: /Serial Number/.test(sheet.rows[0][index]) ? 180 : /OCV|CCA|Used Months/.test(sheet.rows[0][index]) ? 110 : 150, render: displayCell })),
      rows: sheet.rows.slice(1).map(row => ({ key: row.at(-1), ...Object.fromEntries(indexes.map(index => [String(index), row[index]])) })),
    };
  }, [items, filters, filtered, currentPage, movementView]);
  async function download() {
    setBusy(true); setExportError("");
    try {
      await downloadStockReport({ items, ...filters, rows: filtered, generatedAt: dayjs().format("DD-MM-YYYY HH:mm:ss"), generatedBy: session.name || session.username || session.role }, `battery-stock-${filters.view}-${dayjs().format("YYYY-MM-DD-HHmmss")}.xlsx`);
      message.success("Battery Stock Report Downloaded");
    } catch (err) { setExportError(err.message || "The report could not be exported. Please try again."); }
    finally { setBusy(false); }
  }
  const dateLabel = movementView ? "Movement Date" : filters.view === "out" ? "Stock-Out Date" : filters.view === "cancelled" ? "Cancellation Date" : "Stock-In Date";
  return <Modal className="stock-report-modal" title="Battery Stock Report" open width={1500} onCancel={() => !busy && onClose()} closable={!busy} mask={{ closable: !busy }} keyboard={!busy} footer={<div className="stock-report-footer"><span>Export includes all {filtered.length.toLocaleString()} matching {movementView ? "movements" : "batteries"} across every page.</span><div><AppButton className="secondary" disabled={busy} onClick={onClose}>Close</AppButton><AppButton className="primary" aria-label="Export Excel" disabled={busy || !!error || !filtered.length} loading={busy} onClick={download}><Download size={17} />Export Excel</AppButton></div></div>}>
    <p className="stock-report-count">{stockViews[filters.view]} · {filtered.length.toLocaleString()} {movementView ? "movement records" : "batteries"}. Additional details are included in the Excel export.</p>
    <fieldset className="stock-report-filters" disabled={busy}>
      <label>Report Type<Select aria-label="Report Type" disabled={busy} value={filters.view} onChange={value => change("view", value)} options={Object.entries(stockViews).map(([value, label]) => ({ value, label }))} /></label>
      <label className="stock-report-search">Search<Input aria-label="Search Report" disabled={busy} prefix={<Search size={16} />} placeholder="Serial, Model, Dealer..." value={filters.query} onChange={event => change("query", event.target.value)} allowClear /></label>
      <label>Brand<Select aria-label="Report Brand" disabled={busy} allowClear placeholder="All Brands" value={filters.brand} onChange={value => change("brand", value)} options={[...new Set(items.map(item => item.brand).filter(Boolean))].sort().map(value => ({ value, label: value }))} /></label>
      <label>{dateLabel}<RangePicker aria-label="Report Dates" disabled={busy} allowEmpty={[true, true]} value={filters.startDate || filters.endDate ? [filters.startDate ? dayjs(filters.startDate) : null, filters.endDate ? dayjs(filters.endDate) : null] : null} format="DD-MM-YYYY" onChange={dates => { setFilters(current => ({ ...current, startDate: dates?.[0]?.format("YYYY-MM-DD"), endDate: dates?.[1]?.format("YYYY-MM-DD") })); setPage(1); }} /></label>
      <AppButton className="secondary" disabled={busy} onClick={() => { setFilters({ view: filters.view, query: "" }); setPage(1); setExportError(""); }}>Clear Filters</AppButton>
    </fieldset>
    {error && <Alert type="error" showIcon title={error} />}
    <div className="report-table-wrap ant-report-table"><Table aria-label="Battery Stock Report Details" columns={preview.columns} dataSource={preview.rows} rowKey="key" pagination={false} size="small" scroll={{ x: "max-content", y: 420 }} locale={{ emptyText: "No Matching Stock Records" }} /></div>
    <AppPagination page={currentPage} total={filtered.length} pageSize={10} onChange={setPage} />
    {exportError && <Alert type="error" showIcon title={exportError} />}
  </Modal>;
}
