import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Empty, Input, Modal, Select, Spin, Statistic, Tabs, Tag, message } from "antd";
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, Eye, FileText, Package, Pencil, RotateCcw, Save, Search, X } from "lucide-react";
import dayjs from "dayjs";
import { api } from "../api";
import { AppButton, AppDatePicker, AppFieldInput, AppPagination, RangePicker } from "../components/AppControls";
import { groupStockByModel, isStockOnHand, stockMetadata } from "../utils/stockGrouping";
import { filterStockRecords } from "../utils/stockReport";
import StockReportPanel from "./StockReportPanel";
import "./BatteryStock.css";

const kinds = { stock_in: "Stock In", available: "Marked Available", updated: "Details Updated", sold: "Sold", spare: "Issued As Spare", disposed: "Disposed", reversed: "Stock-Out Corrected", cancelled: "Stock In Cancelled" };
const showDate = value => value ? dayjs(value).format("DD-MM-YYYY") : "-";
const labelState = item => item.state === "out" ? kinds[item.out?.type] || "Out" : item.state === "cancelled" ? kinds.cancelled : "Available";
const stateColor = item => item.state === "available" ? "green" : "default";
const shown = value => value === "" || value == null ? "-" : String(value);
const reading = (value, unit) => value === "" || value == null ? "-" : `${value} ${unit}`;

function StockForm({ mode, item, onClose, onSaved }) {
  const [values, setValues] = useState(() => ({
    serial: item?.serial || "", model: item?.model || "", brand: item?.brand || "", sku: item?.sku || "", description: item?.description || "",
    usedMonths: item?.usedMonths ?? "", dealerName: item?.dealerName || "", branchName: item?.branchName || "",
    receivedDate: dayjs().format("YYYY-MM-DD"), date: dayjs().format("YYYY-MM-DD"),
    ocv: item?.ocv || "", cca: item?.cca || "", testResult: item?.testResult || "", notes: item?.notes || "",
    type: "", recipient: "", reference: "", price: "", remarks: "", reason: "",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (name, value) => setValues(current => ({ ...current, [name]: value }));
  const title = { in: "Stock In", update: "Edit Stock Details", out: "Record Stock Out", reverse: "Correct Stock Out", cancel: "Cancel Stock In" }[mode];
  const field = (label, name, type = "text", required = false) => (
    <label className="stock-field" key={name}>
      <span>{label}{required ? " *" : ""}</span>
      {type === "date" ? <AppDatePicker aria-label={label} disabled={busy} value={values[name]} onChange={value => change(name, value)} /> : (
        <AppFieldInput aria-label={label} disabled={busy} type={type} value={values[name]} required={required} maxLength={200} min={type === "number" ? 0 : undefined} precision={name === "price" ? 2 : undefined} onChange={event => change(name, event.target.value)} />
      )}
    </label>
  );
  const select = (label, name, options) => <label className="stock-field"><span>{label} *</span><Select aria-label={label} disabled={busy} value={values[name] || undefined} placeholder={`Select ${label}`} options={options} onChange={value => change(name, value)} /></label>;
  const notes = (label, name) => <label className="stock-field stock-wide"><span>{label}</span><Input.TextArea aria-label={label} disabled={busy} value={values[name]} maxLength={2000} rows={3} onChange={event => change(name, event.target.value)} /></label>;
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await api(mode === "in" ? "/api/battery-stock" : `/api/battery-stock/${item.id}`, {
        method: mode === "in" ? "POST" : "PUT",
        body: JSON.stringify(mode === "in" ? values : { ...values, version: item.version, action: mode }),
      });
      onSaved(result.item);
      message.success(mode === "out" ? "Stock Out Recorded" : mode === "cancel" ? "Stock In Cancelled" : "Battery Stock Saved");
      onClose();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <Modal title={title} open footer={null} width={680} zIndex={1200} onCancel={() => !busy && onClose()} closable={!busy} mask={{ closable: !busy }} keyboard={!busy}>
      {item && <p className="stock-form-identity"><strong>{item.serial}</strong> <span>{item.model}</span></p>}
      {mode === "cancel" && <Alert type="warning" showIcon title="Remove This Battery From Active Stock?" description="The stock record and movement history will be kept. The source claim will remain unchanged. This cancellation cannot be undone." />}
      <form onSubmit={submit}>
        <fieldset className="stock-form-fields" disabled={busy}>
          {mode === "in" && <>{field("Serial Number", "serial", "text", true)}{field("Battery Model", "model", "text", true)}{field("Stock-In Date", "receivedDate", "date", true)}</>}
          {["in", "update"].includes(mode) && <>
            {field("Brand", "brand")}{field("Description", "description")}{field("Used Months", "usedMonths", "number")}{field("Dealer", "dealerName")}{field("Branch Code", "branchName")}
          </>}
          {mode === "in" && notes("Remarks", "notes")}
          {mode === "update" && <>
            {field("Movement Date", "date", "date", true)}
            {field("OCV (V)", "ocv", "number")}{field("CCA (A)", "cca", "number")}{field("Test Result", "testResult")}{notes("Remarks", "notes")}
          </>}
          {mode === "out" && <>
            {select("Stock-Out Type", "type", [{ value: "sold", label: "Sold" }, { value: "spare", label: "Issued As Spare" }, { value: "disposed", label: "Disposed" }])}
            {field("Stock-Out Date", "date", "date", true)}{field(values.type === "sold" ? "Buyer" : "Recipient", "recipient", "text", values.type !== "disposed")}{field("Reference Number", "reference")}
            {values.type === "sold" && field("Selling Price (MYR)", "price", "number")}{notes(values.type === "disposed" ? "Remarks / Disposal Reason *" : "Remarks", "remarks")}
          </>}
          {mode === "reverse" && <>{field("Correction Date", "date", "date", true)}{notes("Correction Reason *", "reason")}</>}
          {mode === "cancel" && <>{field("Cancellation Date", "date", "date", true)}{notes("Cancellation Reason (Optional)", "reason")}</>}
        </fieldset>
        {error && <Alert type="error" showIcon title={error} className="stock-form-error" />}
        <div className="stock-form-actions">
          <AppButton className="secondary" disabled={busy} onClick={onClose}>Cancel</AppButton>
          <AppButton htmlType="submit" className="primary" danger={mode === "cancel"} loading={busy} disabled={busy}><Save size={16} />{mode === "out" ? "Confirm Stock Out" : mode === "reverse" ? "Confirm Correction" : mode === "cancel" ? "Confirm Cancellation" : "Save"}</AppButton>
        </div>
      </form>
    </Modal>
  );
}

function StockDetail({ itemId, onClose, onEdit, claims, onOpenClaim, canCorrect }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api(`/api/battery-stock/${itemId}`, { signal: controller.signal }).then(setDetail).catch(err => { if (err.name !== "AbortError") setError(err.message); });
    return () => controller.abort();
  }, [itemId]);
  const item = detail?.item && stockMetadata(detail.item, new Map(claims.map(claim => [claim.id, claim])));
  const source = item?.sourceClaim && claims.find(claim => claim.id === item.sourceClaim.id);
  return (
    <Modal title={item ? `${item.serial} | ${item.model}` : "Stock Battery"} open width={850} zIndex={1200} onCancel={onClose} footer={<AppButton className="secondary" onClick={onClose}>Close</AppButton>}>
      {error && <Alert type="error" showIcon title={error} />}
      {!detail && !error && <div className="loading-block"><Spin /></div>}
      {item && <>
        <div className="stock-detail-actions"><Tag color={stateColor(item)}>{labelState(item)}</Tag>
          {isStockOnHand(item) && <AppButton className="secondary" onClick={() => onEdit("update", item)}><Pencil size={16} />Edit Details</AppButton>}
          {isStockOnHand(item) && canCorrect && <AppButton danger onClick={() => onEdit("cancel", item)}><X size={16} />Cancel Stock In</AppButton>}
          {item.state === "out" && canCorrect && <AppButton className="secondary" onClick={() => onEdit("reverse", item)}><RotateCcw size={16} />Correct Stock Out</AppButton>}
        </div>
        {item.cancellation && <Alert type="info" showIcon title={`Stock In Cancelled | ${showDate(item.cancellation.date)}`} description={item.cancellation.reason} />}
        <dl className="stock-details">{[
          ["Battery Model", item.model], ["Brand", item.brand], ["Description", item.description], ["Used Months", item.usedMonths], ["Dealer", item.dealerName], ["Branch Code", item.branchName], ["Stock-In Date", showDate(item.receivedDate)], ["Last Test Update", showDate(item.checkedDate)], ["Quantity", 1], ["OCV (V)", item.ocv], ["CCA (A)", item.cca], ["Test Result", item.testResult], ["Remarks", item.notes],
          ...(item.out ? [["Stock-Out Date", showDate(item.out.date)], ["Recipient", item.out.recipient], ["Reference", item.out.reference], ["Selling Price (MYR)", item.out.price], ["Stock-Out Remarks", item.out.remarks]] : []),
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{shown(value)}</dd></div>)}</dl>
        <section className="stock-source"><h3>Source</h3>
          {item.sourceClaim ? <><p>{item.sourceClaim.caseNumber || item.sourceClaim.id} | {showDate(item.sourceClaim.reportDate)} | {shown(item.sourceClaim.result)}</p><AppButton className="secondary" disabled={!source} onClick={() => { onClose(); onOpenClaim(source); }}><Eye size={16} />View Source Claim</AppButton></> : <p>Manual Stock In</p>}
        </section>
        <section className="stock-history"><h3>Movement History</h3><ol>
          {detail.movements.map(event => <li key={event.id}>
            <div><strong>{kinds[event.kind]}</strong><span>{showDate(event.date)}</span></div>
            <small>{event.actor} | Recorded {dayjs(event.recordedAt).format("DD MMM YYYY, h:mm A")}</small>
            {event.details.recipient && <p>Recipient: {event.details.recipient}</p>}
            {event.details.reference && <p>Reference: {event.details.reference}</p>}
            {event.details.price && <p>MYR {event.details.price}</p>}
            {(event.details.reason || event.details.remarks) && <p>{event.details.reason || event.details.remarks}</p>}
            {event.changes.filter(change => ["sku", "brand", "description", "usedMonths", "dealerName", "branchName", "ocv", "cca", "testResult", "notes"].includes(change.field)).map(change => <p key={change.field}>{({ sku: "Item Code", brand: "Brand", description: "Description", usedMonths: "Used Months", dealerName: "Dealer", branchName: "Branch Code", ocv: "OCV", cca: "CCA", testResult: "Test Result", notes: "Remarks" })[change.field]}: {shown(change.before)} to {shown(change.after)}</p>)}
          </li>)}
        </ol></section>
      </>}
    </Modal>
  );
}

function ModelStockDetails({ group, actions, page, onPageChange }) {
  const currentPage = Math.min(page, Math.max(1, Math.ceil(group.items.length / 10)));
  const visibleItems = group.items.slice((currentPage - 1) * 10, currentPage * 10);
  return <section className="stock-selected-content" aria-label="Battery Model Details">
    <div className="stock-table-wrap"><table aria-label={`Batteries For ${group.model || "Model Not Recorded"}`}>
      <thead><tr><th>Previous Serial Number</th><th>Stock-In Date</th><th>Used Months</th><th>Latest Test</th><th>Actions</th></tr></thead>
      <tbody>{visibleItems.map(item => <tr key={item.id}>
        <td className="stock-battery-identity"><strong>{item.sourceClaim?.serial || item.serial}</strong><Tag color={stateColor(item)}>{labelState(item)}</Tag></td>
        <td data-label="Stock-In Date">{showDate(item.receivedDate)}</td>
        <td data-label="Used Months">{shown(item.usedMonths)}</td>
        <td data-label="Latest Test"><div className="stock-test-reading"><span><small>OCV</small><strong>{reading(item.ocv, "V")}</strong></span><span><small>CCA</small><strong>{reading(item.cca, "A")}</strong></span></div></td>
        <td className="stock-action-cell">{actions(item)}</td>
      </tr>)}</tbody>
    </table></div>
    <div className="stock-detail-pagination" role="navigation" aria-label={`Battery Pages For ${group.model || "Model Not Recorded"}${group.brand ? `, ${group.brand}` : ""}`}>
      <AppPagination page={currentPage} total={group.items.length} pageSize={10} onChange={onPageChange} />
    </div>
  </section>;
}

export default function BatteryStock({ session, claims, onOpenClaim }) {
  const [rawItems, setItems] = useState([]), [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [view, setView] = useState("in"), [query, setQuery] = useState("");
  const [brand, setBrand] = useState();
  const [expandedSkus, setExpandedSkus] = useState(() => new Set());
  const [detailPages, setDetailPages] = useState({});
  const [range, setRange] = useState(null), [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null), [detailId, setDetailId] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const latestRequest = useRef(0);
  const permitted = ["owner", "admin", "warehouse_preview"].includes(session.role);
  const refresh = useCallback(async signal => {
    const request = ++latestRequest.current;
    try {
      const [stock, ledger] = await Promise.all([api("/api/battery-stock", { signal }), api("/api/battery-stock/movements", { signal })]);
      if (signal?.aborted || request !== latestRequest.current) return;
      setItems(stock.items); setMovements(ledger.movements); setError("");
    } catch (err) { if (err.name !== "AbortError" && request === latestRequest.current) setError(err.status === 404 ? "Battery Stock is not installed on the backend yet." : err.message); }
    finally { if (!signal?.aborted && request === latestRequest.current) setLoading(false); }
  }, []);
  useEffect(() => {
    if (!permitted) return;
    const controller = new AbortController();
    const reload = () => refresh(controller.signal);
    reload();
    const timer = setInterval(reload, 15000);
    const resume = () => { if (document.visibilityState === "visible") reload(); };
    document.addEventListener("visibilitychange", resume);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", resume); };
  }, [refresh, permitted]);
  const items = useMemo(() => {
    const claimsById = new Map(claims.map(claim => [claim.id, claim]));
    return rawItems.map(item => stockMetadata(item, claimsById));
  }, [rawItems, claims]);
  const onHand = items.filter(isStockOnHand);
  const filtered = useMemo(() => filterStockRecords({ items, movements, view, query, brand, startDate: range?.[0]?.format("YYYY-MM-DD"), endDate: range?.[1]?.format("YYYY-MM-DD") }), [items, movements, query, brand, range, view]);
  useEffect(() => { setPage(1); setDetailPages({}); }, [query, brand, range, view]);
  const groups = useMemo(() => view === "movements" ? [] : groupStockByModel(filtered), [filtered, view]);
  const rows = view === "movements" ? filtered : groups;
  const pageCount = Math.max(1, Math.ceil(rows.length / 15));
  useEffect(() => setPage(current => Math.min(current, pageCount)), [pageCount]);
  const visible = rows.slice((page - 1) * 15, page * 15);
  const toggleSku = key => setExpandedSkus(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const edit = (mode, item) => { setDetailId(null); setDialog({ mode, item }); };
  const actions = item => <div className="stock-row-actions">
    <AppButton type="text" title="View Battery" aria-label={`View ${item.serial}`} onClick={() => setDetailId(item.id)}><Eye size={17} /></AppButton>
    {isStockOnHand(item) && <AppButton type="text" title="Edit Details" aria-label={`Edit ${item.serial}`} onClick={() => edit("update", item)}><Pencil size={17} /></AppButton>}
    {isStockOnHand(item) && <AppButton type="text" title="Stock Out" aria-label={`Stock Out ${item.serial}`} onClick={() => edit("out", item)}><ArrowUpFromLine size={17} /></AppButton>}
  </div>;
  if (!permitted) return <Alert type="error" title="Battery Stock access required." />;
  return (
    <div className="battery-stock">
      <div className="stock-heading"><h1>Battery Stock</h1><div><AppButton className="secondary" disabled={loading} onClick={() => setReportOpen(true)}><FileText size={17} />Report</AppButton><AppButton className="primary" onClick={() => setDialog({ mode: "in" })}><ArrowDownToLine size={17} />Stock In</AppButton></div></div>
      <div className="stock-metrics">{[
        ["Available", onHand.length], ["Out", items.filter(item => item.state === "out").length], ["Cancelled", items.filter(item => item.state === "cancelled").length],
      ].map(([title, value]) => <article key={title}><Package size={20} /><Statistic title={title} value={value} /></article>)}</div>
      {error && <Alert className="stock-error" type="error" showIcon title={error} />}
      <section className="stock-workspace">
        <Tabs activeKey={view} onChange={setView} items={[{ key: "in", label: "In Stock" }, { key: "out", label: "Out" }, { key: "cancelled", label: "Cancelled" }, { key: "movements", label: "Movements" }]} />
        <div className="stock-filters">
          <Input aria-label="Search Stock" prefix={<Search size={16} />} placeholder="Search Model, Serial Or Dealer" value={query} onChange={event => setQuery(event.target.value)} allowClear />
          <Select aria-label="Filter Brand" value={brand} onChange={setBrand} allowClear placeholder="Brand: All" options={[...new Set(items.map(item => item.brand).filter(Boolean))].sort().map(value => ({ value, label: value }))} />
          <RangePicker aria-label="Filter Stock Dates" value={range} onChange={setRange} format="DD-MM-YYYY" />
          <AppButton type="text" title="Clear Filters" aria-label="Clear Filters" onClick={() => { setQuery(""); setBrand(undefined); setRange(null); }}><X size={17} /></AppButton>
        </div>
        {loading ? <div className="loading-block"><Spin /></div> : !visible.length ? <Empty className="stock-empty" description="No Stock Records Found" /> : view === "movements" ? (
          <div className="stock-ledger">{visible.map(event => <article key={event.id}>
            <div><strong>{event.serial}</strong><span>{event.model}</span></div><div><strong>{kinds[event.kind]}</strong><span>{showDate(event.date)} | {event.actor}</span></div>
            <span>{event.details.recipient || event.details.reason || event.details.remarks || ""}</span>
            <AppButton type="text" aria-label={`View movement for ${event.serial}`} onClick={() => setDetailId(event.itemId)}><Eye size={17} /></AppButton>
          </article>)}</div>
        ) : <section className="stock-catalog" aria-label="Stock By Battery Model">
            <div className="stock-catalog-list"><table className="stock-catalog-table" aria-label="Battery Model Stock List">
              <thead><tr><th>Battery Model</th><th>Brand</th><th>Description</th><th>{view === "out" ? "Out Qty" : view === "cancelled" ? "Cancelled" : "Available"}</th></tr></thead>
              <tbody>{visible.map(group => <Fragment key={group.key}><tr className="stock-sku-row" tabIndex={0}
                aria-expanded={expandedSkus.has(group.key)} aria-controls={`stock-sku-details-${encodeURIComponent(group.key)}`}
                aria-label={`Stock For ${group.model || "Model Not Recorded"}${group.brand ? `, ${group.brand}` : ""}`}
                onClick={() => toggleSku(group.key)} onKeyDown={event => { if (event.target === event.currentTarget && ["Enter", " "].includes(event.key)) { event.preventDefault(); toggleSku(group.key); } }}>
                <td className="stock-sku-code" data-label="Battery Model"><span className="stock-sku-identity"><AppButton type="text" className="stock-sku-toggle" aria-label={`${expandedSkus.has(group.key) ? "Collapse" : "Expand"} ${group.model || "Model Not Recorded"}`} aria-expanded={expandedSkus.has(group.key)} aria-controls={`stock-sku-details-${encodeURIComponent(group.key)}`} onClick={event => { event.stopPropagation(); toggleSku(group.key); }}><ChevronRight size={16} /></AppButton><strong>{group.model || "Model Not Recorded"}</strong></span></td>
                <td className="stock-sku-brand" data-label="Brand">{shown(group.brand)}</td>
                <td className="stock-sku-description" data-label="Description">{group.description || group.model}</td>
                <td className="stock-sku-quantity" data-label={view === "out" ? "Out Qty" : view === "cancelled" ? "Cancelled" : "Available"}><strong>{group.items.length}</strong></td>
              </tr>
              {expandedSkus.has(group.key) && <tr className="stock-expanded-row" id={`stock-sku-details-${encodeURIComponent(group.key)}`}><td colSpan={4}><ModelStockDetails group={group} actions={actions} page={detailPages[group.key] || 1} onPageChange={nextPage => setDetailPages(current => ({ ...current, [group.key]: nextPage }))} /></td></tr>}
              </Fragment>)}</tbody>
            </table></div>
            <AppPagination page={page} total={groups.length} pageSize={15} onChange={setPage} />
          </section>}
        {view === "movements" && <AppPagination page={page} total={rows.length} pageSize={15} onChange={setPage} />}
      </section>
      {reportOpen && <StockReportPanel items={items} movements={movements} session={session} error={error} initialFilters={{ view, query, brand, startDate: range?.[0]?.format("YYYY-MM-DD"), endDate: range?.[1]?.format("YYYY-MM-DD") }} onClose={() => setReportOpen(false)} />}
      {dialog && <StockForm key={`${dialog.mode}:${dialog.item?.id || "new"}`} {...dialog} onClose={() => setDialog(null)} onSaved={() => refresh()} />}
      {detailId && <StockDetail itemId={detailId} onClose={() => setDetailId(null)} onEdit={edit} claims={claims} onOpenClaim={onOpenClaim} canCorrect={["owner", "admin"].includes(session.role)} />}
    </div>
  );
}
