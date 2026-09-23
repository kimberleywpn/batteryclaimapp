import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Checkbox,
  DatePicker,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Tabs,
  Timeline,
  Tooltip,
  Typography,
} from "antd";
import {
  BarChart3,
  Ban,
  BatteryCharging,
  Check,
  FileText,
  History,
  List,
  LogOut,
  PackageOpen,
  Plus,
  Printer,
  Search as SearchIcon,
  ScanLine,
  ShieldCheck,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import dayjs from "dayjs";
import { api, setAuthToken } from "./api";
import { AppButton, AppPagination, SearchInput } from "./components/AppControls";
import StatusTabs from "./components/StatusTabs";
import { AdminProcess, ApprovalForm, ClaimForm, WarehouseData } from "./features/WorkflowForms";
import { additionalMetrics, formatDisplayDate, shown, stageLabel, titleCase } from "./utils/claimFormatting";

const ManagementDashboard = lazy(() => import("./features/ManagementDashboard"));
const ReportPanel = lazy(() => import("./features/ReportPanel"));
const MobileCodeScanner = lazy(() => import("./components/MobileCodeScanner"));
const brandLogo = `${import.meta.env.BASE_URL}kai-shen-logo.svg`;

const pages = [
  { id: "claims", label: "Claims Operations", icon: List },
  { id: "sales", label: "Sales Approvals", icon: ShieldCheck },
  { id: "dashboard", label: "Management Dashboard", icon: BarChart3 },
];

const pagesForRole = (role) => {
  if (role === "manager") return pages.filter((item) => item.id === "dashboard");
  if (role === "sales") return pages.filter((item) => item.id !== "claims");
  return pages;
};

function SignIn({ onSuccess }) {
  const [formApi] = Form.useForm();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(values) {
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setAuthToken(result.token);
      onSuccess(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="signin-page">
      <Form
        className="signin-panel"
        form={formApi}
        layout="vertical"
        onFinish={submit}
      >
        <div className="signin-brand">
          <img className="brand-logo" src={brandLogo} alt="Kai Shen" />
          <div>
            <strong>Battery Claim App</strong>
          </div>
        </div>
        <h1>Sign In</h1>
        <Form.Item
          label="Username"
          name="username"
          rules={[{ required: true, message: "Enter Username." }]}
        >
          <Input name="username" autoComplete="username" required autoFocus />
        </Form.Item>
        <Form.Item
          label="Password"
          name="password"
          rules={[{ required: true, message: "Enter Password." }]}
        >
          <Input.Password
            name="password"
            autoComplete="current-password"
            required
          />
        </Form.Item>
        {error && (
          <Alert className="app-alert" type="error" showIcon message={error} />
        )}
        <AppButton className="primary" htmlType="submit" loading={busy}>
          {busy ? "Signing In..." : "Sign In"}
        </AppButton>
      </Form>
    </main>
  );
}

const claimViews = [
  { id: "all", label: "All Cases", statuses: null },
  { id: "reported", label: "Collection", statuses: ["reported"] },
  {
    id: "arrived",
    label: "Warehouse Inspecting",
    statuses: ["arrived", "tested"],
  },
  { id: "admin", label: "Claim Processing", statuses: ["admin", "settlement"] },
  { id: "sales", label: "Sales Approval", statuses: ["sales"] },
  { id: "complete", label: "Completed", statuses: ["complete"] },
  { id: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
];
function daysSinceReport(value) {
  if (!value) return null;
  const start = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!Number.isFinite(start.getTime()) || start >= today) return 0;
  return Math.floor((today.getTime() - start.getTime()) / 86400000);
}
function stageDetail(claim, view) {
  if (view === "reported") {
    const days = daysSinceReport(claim.claimDate);
    return days === null
      ? "Report Date Not Recorded"
      : `${days} Day${days === 1 ? "" : "s"} Since Report`;
  }
  if (view === "arrived") {
    const data = claim.warehouse || {};
    return [
      ["Arrived", data.receivedDate],
      ["First Test Date", data.firstTestDate],
      ["Second Test Date", data.secondTestDate],
    ].map(([label, date]) => (
      <span key={label} className={date ? "stage-date-complete" : undefined}>
        {label} - {date ? formatDisplayDate(date) : "Pending"}
      </span>
    ));
  }
  if (claim.status === "complete")
    return claim.admin?.result
      ? String(claim.admin.result)
          .toLowerCase()
          .replace(/\b\w/g, (letter) => letter.toUpperCase())
      : "Result Not Recorded";
  if (claim.status === "cancelled")
    return claim.cancellation?.reason || "Claim Cancelled";
  return (
    {
      reported: "Arrange Battery Collection",
      arrived: "Warehouse Inspection In Progress",
      tested: "Warehouse Inspection In Progress",
      admin: "Review Result And Send For Approval",
      sales: "Awaiting Sales Approval",
      settlement: "Complete Settlement Details",
    }[claim.status] || "In Progress"
  );
}

const previewShown = (value) =>
  value == null || String(value).trim() === "" ? "-" : formatDisplayDate(value);

function DetailFields({ fields }) {
  return (
    <div className="detail-grid">
      {fields.map(([label, value, breakBefore]) => (
        <div className={`detail-field${breakBefore ? " detail-field-break" : ""}`} key={label}>
          <span>{label}</span>
          <strong>{previewShown(value)}</strong>
        </div>
      ))}
    </div>
  );
}
const historyLabels = {
  created: "Claim Reported",
  intake: "Claim Information Updated",
  warehouse: "Warehouse Data Saved",
  "warehouse-bulk-received": "Received In Bulk",
  admin: "Claim Processing Updated",
  approval: "Sales Decision Submitted",
  imported: "Historical Claim Imported",
  cancelled: "Claim Cancelled",
  deleted: "Case Deleted",
};
function CaseHistory({ claimId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api(`/api/claims/${encodeURIComponent(claimId)}/history`)
      .then((result) => {
        if (active) setEntries((result.history || []).slice(0, 5));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [claimId]);
  return (
    <div className="preview-section case-history">
      <h3>
        <History size={16} />
        Recent Activity
      </h3>
      {loading ? (
        <div className="history-empty">
          <Spin size="small" />
        </div>
      ) : entries.length ? (
        <Timeline
          items={entries.map((entry, index) => ({
            key: `${entry.at}-${index}`,
            children: (
              <Space direction="vertical" size={0}>
                <Typography.Text strong>
                  {historyLabels[entry.action] ||
                    String(entry.action || "Case Updated")
                      .replace(/-/g, " ")
                      .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                </Typography.Text>
                <Typography.Text type="secondary">
                  {entry.actor || "System"} ·{" "}
                  {entry.at
                    ? dayjs(entry.at).format("DD-MM-YYYY, h:mm:ss A")
                    : "Time Not Recorded"}
                </Typography.Text>
              </Space>
            ),
          }))}
        />
      ) : (
        <Empty
          className="compact-empty history-empty"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No Activity Recorded"
        />
      )}
    </div>
  );
}
function CasePhotos({ claimId }) {
  const [photos, setPhotos] = useState({ battery: [], test: [] });
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const id = encodeURIComponent(claimId);
    Promise.all([
      api(`/api/claims/${id}/photos`).catch(() => ({ battery: [], test: [] })),
      api(`/api/claims/${id}/attachments`).catch(() => ({ attachments: [] })),
    ])
      .then(([files, adminFiles]) => {
        if (active) {
          setPhotos({ battery: files.battery || [], test: files.test || [] });
          setAttachments(adminFiles.attachments || []);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [claimId]);
  const groups = [
    ["Battery Photos", "battery"],
    ["Test Result Photos", "test"],
  ];
  return (
    <Image.PreviewGroup>
      {loading ? (
        <div className="preview-section photo-preview-empty">
          <Spin size="small" />
        </div>
      ) : (
        <>
          <div className="preview-section case-photos">
            <h3>Warehouse Attachments</h3>
            <div className="case-photo-groups">
              {groups.map(([title, key]) => (
                <section key={key}>
                  <div className="case-photo-title">
                    <strong>{title}</strong>
                    <span>{photos[key].length}</span>
                  </div>
                  {photos[key].length ? (
                    <div className="case-photo-grid">
                      {photos[key].map((photo) => (
                        <figure key={photo.id}>
                          <Image
                            src={`data:${photo.type};base64,${photo.base64}`}
                            alt={photo.name || title}
                            preview={{ mask: "Preview" }}
                          />
                          <figcaption>{photo.name || "Photo"}</figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      className="compact-empty photo-preview-empty"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="No Photos Attached"
                    />
                  )}
                </section>
              ))}
            </div>
          </div>
          <div className="preview-section case-photos admin-preview-attachments">
            <h3>Admin Attachments</h3>
            <div className="case-photo-groups admin-attachment-groups">
              <section>
                <div className="case-photo-title">
                  <strong>Supporting Documents</strong>
                  <span>{attachments.length}</span>
                </div>
                {attachments.length ? (
                  <div className="case-photo-grid case-attachment-grid">
                    {attachments.map((file) => {
                      const url = `data:${file.type};base64,${file.base64}`;
                      return file.type?.startsWith("image/") ? (
                        <figure key={file.id}>
                          <Image
                            src={url}
                            alt={file.name || "Admin attachment"}
                            preview={{ mask: "Preview" }}
                          />
                          <figcaption>{file.name || "Image"}</figcaption>
                        </figure>
                      ) : (
                        <a
                          className="case-document-link"
                          href={url}
                          download={file.name || "attachment"}
                          key={file.id}
                          title={file.name}
                        >
                          <FileText size={24} />
                          <span>{file.name || "Attachment"}</span>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <Empty
                    className="compact-empty photo-preview-empty"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No Admin Attachments"
                  />
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </Image.PreviewGroup>
  );
}
function CasePreview({ claim, onClose, onEdit, onCancelClaim, onDelete }) {
  const warehouse = claim.warehouse || {};
  const admin = claim.admin || {};
  const approval = claim.approval || {};
  const additionalFields = [
    ["Claim Date", admin.claimDate],
    ["Invoice Date", claim.invoiceDate],
    ["Battery Installed Date", admin.batteryInstalledDate],
    ["Car Model / Variant", admin.carModel],
    ["Vehicle Registration Number", admin.vehicleRegistrationNo],
    ["Vehicle Registration Date", admin.vehicleRegistrationDate],
    ["Previous Installed Mileage", admin.mileage1],
    ["Current Mileage", admin.mileage2],
    ["Direct Replaced S/N", admin.directReplacedSerialNo],
    ["Remarks", admin.remarks1],
  ];
  const hasAdditionalDetails = additionalFields.some(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  return (
    <Modal
      className="case-preview-modal"
      open
      footer={null}
      closable={false}
      width={1120}
      onCancel={onClose}
      mask={{ closable: true }}
      destroyOnHidden
    >
      <section className="case-preview" aria-label={`Case ${claim.serial}`}>
        <AppButton
          className="sticky-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </AppButton>
        <div className="preview-head">
          <div>
            <span className="eyebrow">Combined Case Record</span>
            <h2>
              <span>{claim.serial}</span>
              <i aria-hidden="true" />
              <span>{previewShown(claim.model)}</span>
            </h2>
            <p>
              {previewShown(claim.customer || claim.dealerName)} | {previewShown(claim.branchName)} | {previewShown(claim.area)}{" "}
              | {previewShown(claim.salesperson)}
            </p>
          </div>
          <div className="preview-actions">
            {onEdit && (
              <AppButton className="secondary" onClick={onEdit}>
                Edit Claim Information
              </AppButton>
            )}
            {onCancelClaim && (
              <AppButton
                className="secondary icon-action danger-action"
                onClick={onCancelClaim}
                aria-label="Cancel Claim"
                title="Cancel Claim"
              >
                <Ban size={17} />
              </AppButton>
            )}
            {onDelete && (
              <AppButton
                className="secondary icon-action danger-action"
                onClick={onDelete}
                aria-label="Delete Case"
                title="Delete Case"
              >
                <Trash2 size={17} />
              </AppButton>
            )}
            <AppButton
              className="secondary icon-action"
              onClick={() => window.print()}
              aria-label="Print Case"
              title="Print Case"
            >
              <Printer size={17} />
            </AppButton>
          </div>
        </div>
        <span className="detail-status">{stageLabel(claim.status)}</span>
        {claim.status === "cancelled" && (
          <div className="preview-section cancellation-section">
            <h3>Cancellation</h3>
            <DetailFields fields={[
              ["Reason", claim.cancellation?.reason],
              ["Cancelled By", claim.cancellation?.cancelledBy],
              [
                "Cancelled Date",
                claim.cancellation?.cancelledAt
                  ? dayjs(claim.cancellation.cancelledAt).format("DD-MM-YYYY, h:mm:ss A")
                  : "",
              ],
            ]} />
          </div>
        )}
        <div className="preview-section claim-information-section">
          <h3>Claim Information</h3>
          <DetailFields
            fields={[
              ["Customer Name", claim.customer || claim.dealerName],
              ["Branch Code", claim.branchName],
              ["Area", claim.area],
              ["CRF No.", claim.crfNo],
              ["Sales Agent", claim.salesperson],
              ["Invoice No.", claim.invoiceNo],
              ["Invoice Date", claim.invoiceDate],
              ["Battery Used Months", claim.batteryUsedMonths],
              ["Battery Model", claim.model],
              ["Brand", claim.itemGroup],
              ["Item Description", claim.itemDescription],
            ]}
          />
        </div>
        <div className="preview-section warehouse-preview-section">
          <h3>Warehouse Inspection</h3>
          <DetailFields
            fields={[
              [
                "Date Received",
                warehouse.receivedDate || warehouse.inspectionDate,
              ],
              ["Battery Batch / Code", warehouse.batchCode],
              ["Production Date", warehouse.productDate],
              ["Factory", warehouse.factory],
              ["First Test Date", warehouse.firstTestDate],
              ["Pre-charge OCV", warehouse.preOcv],
              ["Pre-charge CCA", warehouse.preCca],
              ["Second Test Date", warehouse.secondTestDate, true],
              ["12 Hrs OCV", warehouse.postOcv],
              ["12 Hrs CCA", warehouse.postCca],
              ["Load Test (V)", warehouse.loadTestVoltage, true],
              ["Load Test Result", warehouse.loadTestResult],
              ["Judgment Results", warehouse.judgment, true],
              ["Hydrometer", warehouse.hydrometer],
              ["Result", warehouse.result],
            ]}
          />
        </div>
        <div className="preview-section">
          <h3>Claim Processing</h3>
          <DetailFields
            fields={[
              ["Result", admin.result],
              ["WAN No.", admin.wanNo],
              ["Replace Item", admin.replaceItem || admin.replaceBrand],
              ["Replace Serial No.", admin.replaceSerialNo],
              ["Settle Date", admin.settleDate],
              ["Pending With Reason", admin.pendingReason],
            ]}
          />
        </div>
        {hasAdditionalDetails && (
          <div className="preview-section">
            <h3>Additional Claim Details</h3>
            <DetailFields fields={additionalFields} />
          </div>
        )}
        <div className="preview-section">
          <h3>Salesperson Approval</h3>
          <DetailFields
            fields={[
              ["Decision", approval.decision],
              ["Comments", approval.comments],
              ["Salesperson", approval.approvedBy || claim.salesperson],
              ["Decision Date", approval.decidedAt?.slice(0, 10)],
            ]}
          />
        </div>
        <CasePhotos claimId={claim.id} />
        <CaseHistory claimId={claim.id} />
      </section>
    </Modal>
  );
}

const salesViews = [
  { id: "progress", label: "In Progress" },
  { id: "pending", label: "Awaiting My Review" },
  { id: "history", label: "Review History" },
];
function SalesApprovals({ claims, onClaimSaved, session }) {
  const [view, setView] = useState("progress");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState(null);
  const [review, setReview] = useState(null);
  const pageSize = 10;
  const canApprove = ["owner", "sales"].includes(session.role);
  const categories = useMemo(
    () => ({
      progress: claims.filter((c) =>
        ["reported", "arrived", "tested", "admin"].includes(c.status),
      ),
      pending: claims.filter(
        (c) =>
          c.status === "sales" &&
          (!c.approval?.decision || c.approval.decision === "pending"),
      ),
      history: claims.filter((c) =>
        ["approved", "review_requested"].includes(c.approval?.decision),
      ),
    }),
    [claims],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return categories[view].filter(
      (c) =>
        !needle ||
        `${c.serial} ${c.model} ${c.customer} ${c.dealerName} ${c.area} ${c.salesperson} ${c.admin?.result}`
          .toLowerCase()
          .includes(needle),
    );
  }, [categories, view, query]);
  useEffect(() => setPage(1), [view, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const metric = (value, label, tone) => (
    <article>
      <span className={`approval-dot ${tone}`} />
      <Statistic title={label} value={value} groupSeparator="," />
    </article>
  );
  const status = (c) =>
    ["reported", "arrived", "tested", "admin"].includes(c.status)
      ? stageLabel(c.status)
      : c.approval?.decision === "review_requested"
        ? "Review Requested"
        : c.status === "sales"
          ? "Awaiting Sales Approval"
          : "Approved";
  return (
    <>
      <section className="sales-metrics">
        {metric(categories.pending.length, "Pending Approval", "amber")}
        {metric(
          claims.filter((c) => c.approval?.decision === "approved").length,
          "Approved",
          "green",
        )}
        {metric(
          claims.filter((c) => c.approval?.decision === "review_requested")
            .length,
          "Review Requested",
          "red",
        )}
      </section>
      <section className="surface workspace sales-workspace">
        <div className="list-toolbar">
          <StatusTabs
            label="Sales Approval Status"
            className="sales-status-tabs"
            activeKey={view}
            onChange={setView}
            items={salesViews.map((item) => ({
              ...item,
              count: categories[item.id].length,
            }))}
          />
          <SearchInput
            className="app-search-input workspace-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Claim Or Salesperson"
            allowClear
          />
        </div>
        <div className="sales-list">
          {visible.map((c) => {
            const inProgress = [
                "reported",
                "arrived",
                "tested",
                "admin",
              ].includes(c.status),
              decided = ["approved", "review_requested"].includes(
                c.approval?.decision,
              );
            return (
              <article className="sales-card" key={c.id}>
                <div>
                  <AppButton
                    className="serial-link"
                    onClick={() => setPreview(c)}
                  >
                    {c.serial}
                  </AppButton>
                  <div className="case-model">{shown(c.model)}</div>
                  <div className="secondary-text">
                    Report Date: {shown(c.claimDate)}
                  </div>
                </div>
                <div>
                  <div className="customer">
                    {shown(c.customer || c.dealerName)}
                    {c.branchName && (
                      <small className="branch-code">{c.branchName}</small>
                    )}
                  </div>
                  <div className="case-area">{shown(c.area)}</div>
                  <div className="case-agent">{shown(c.salesperson)}</div>
                </div>
                <div>
                  <div className="stage-title">{status(c)}</div>
                  <div className="stage-next">
                    {inProgress ? stageDetail(c, view) : shown(c.admin?.result)}
                  </div>
                </div>
                <AppButton
                  className={
                    inProgress || !canApprove ? "secondary" : "primary"
                  }
                  onClick={() => (inProgress ? setPreview(c) : setReview(c))}
                >
                  {inProgress
                    ? "View Case"
                    : decided
                      ? "View Decision"
                      : canApprove
                        ? "Review Result"
                        : "View Result"}
                </AppButton>
              </article>
            );
          })}
        </div>
        {!visible.length && (
          <div className="empty">
            <Check size={22} />
            <strong>No Approvals Found</strong>
            <span>There Are No Cases In This View.</span>
          </div>
        )}
        <AppPagination
          page={page}
          total={filtered.length}
          pageSize={pageSize}
          onChange={setPage}
        />
      </section>
      {preview && (
        <CasePreview claim={preview} onClose={() => setPreview(null)} />
      )}{" "}
      {review && (
        <ApprovalForm
          claim={review}
          canApprove={canApprove}
          onClose={() => setReview(null)}
          onSaved={onClaimSaved}
        />
      )}
    </>
  );
}

function DeleteClaimDialog({ claim, onCancel, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/claims/${encodeURIComponent(claim.id)}/delete`, {
        method: "POST",
        body: JSON.stringify({ version: claim.version }),
      });
      onDeleted(claim.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title="Delete Case?"
      okText="Delete Case"
      cancelText="Cancel"
      okButtonProps={{ danger: true, loading: busy }}
      cancelButtonProps={{ disabled: busy }}
      closable={!busy}
      mask={{ closable: !busy }}
      onOk={remove}
      onCancel={onCancel}
    >
      <p>
        <strong>{claim.serial}</strong>
        {claim.model ? ` | ${claim.model}` : ""}
      </p>
      <p>
        The case will be removed from lists and reports. Its record and photos
        will remain retained in the database.
      </p>
      {error && (
        <Alert className="app-alert" type="error" showIcon message={error} />
      )}
    </Modal>
  );
}

function CancelClaimDialog({ claim, onClose, onCancelled }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function cancelClaim() {
    const value = reason.trim();
    if (!value) {
      setError("Enter a cancellation reason.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api(`/api/claims/${encodeURIComponent(claim.id)}/cancel`, {
        method: "POST",
        body: JSON.stringify({ version: claim.version, reason: value }),
      });
      onCancelled(result.claim);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title="Cancel Claim?"
      okText="Cancel Claim"
      cancelText="Keep Claim"
      okButtonProps={{ danger: true, loading: busy }}
      cancelButtonProps={{ disabled: busy }}
      closable={!busy}
      mask={{ closable: !busy }}
      onOk={cancelClaim}
      onCancel={onClose}
    >
      <p><strong>{claim.serial}</strong>{claim.model ? ` | ${claim.model}` : ""}</p>
      <p>The case will remain searchable and viewable, but no further workflow actions will be allowed.</p>
      <Input.TextArea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Cancellation reason"
        rows={4}
        maxLength={2000}
        disabled={busy}
        autoFocus
      />
      {error && <Alert className="app-alert" type="error" showIcon message={error} />}
    </Modal>
  );
}

function progressFilters(view) {
  if (view === "arrived")
    return [
      { id: "all", label: "All", test: () => true },
      {
        id: "first",
        label: "Awaiting First Test",
        test: (claim) => !claim.warehouse?.firstTestDate,
      },
      {
        id: "second",
        label: "Awaiting Second Test",
        test: (claim) =>
          !!claim.warehouse?.firstTestDate && !claim.warehouse?.secondTestDate,
      },
    ];
  if (view === "admin")
    return [
      { id: "all", label: "All", test: () => true },
      {
        id: "not-sent",
        label: "Result Not Sent",
        test: (claim) =>
          claim.status === "admin" &&
          claim.approval?.decision !== "review_requested",
      },
      {
        id: "review",
        label: "Review Requested",
        test: (claim) =>
          claim.status === "admin" &&
          claim.approval?.decision === "review_requested",
      },
      {
        id: "approved",
        label: "Approved / Settlement Pending",
        test: (claim) => claim.status === "settlement",
      },
    ];
  return [];
}

function Claims({ claims, session, onClaimSaved, onClaimDeleted }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");
  const [subfilter, setSubfilter] = useState("all");
  const [dateSort, setDateSort] = useState("desc");
  const [page, setPage] = useState(1);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [claimForm, setClaimForm] = useState(null);
  const [adminClaim, setAdminClaim] = useState(null);
  const [warehouseClaim, setWarehouseClaim] = useState(null);
  const [deleteClaim, setDeleteClaim] = useState(null);
  const [cancelClaim, setCancelClaim] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [receiveDate, setReceiveDate] = useState(dayjs());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const canManage = ["owner", "admin"].includes(session.role);
  const pageSize = 10;
  const counts = useMemo(
    () =>
      Object.fromEntries(
        claimViews.map((item) => [
          item.id,
          item.statuses
            ? claims.filter((c) => item.statuses.includes(c.status)).length
            : claims.length,
        ]),
      ),
    [claims],
  );
  const baseFiltered = useMemo(() => {
    const statuses = claimViews.find((item) => item.id === view)?.statuses;
    const needle = query.trim().toLowerCase();
    return claims.filter(
      (c) =>
        (!statuses || statuses.includes(c.status)) &&
        (!needle ||
          `${c.serial} ${c.customer} ${c.dealerName} ${c.branchName} ${c.area} ${c.salesperson} ${c.model}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [claims, query, view]);
  const subfilters = progressFilters(view);
  const activeSubfilter =
    subfilters.find((item) => item.id === subfilter) || subfilters[0];
  const filtered = activeSubfilter
    ? baseFiltered.filter(activeSubfilter.test)
    : baseFiltered;
  const sortedFiltered = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const comparison = String(a.claimDate || "").localeCompare(
          String(b.claimDate || ""),
        );
        return dateSort === "asc" ? comparison : -comparison;
      }),
    [filtered, dateSort],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = sortedFiltered.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const selectableVisible = view === "reported" ? visible.filter((claim) => claim.status === "reported" && !claim.warehouse?.receivedDate) : [];
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every((claim) => selectedIds.includes(claim.id));
  useEffect(() => setPage(1), [query, view]);
  useEffect(() => setSubfilter("all"), [view]);
  useEffect(() => setPage(1), [subfilter]);
  useEffect(() => setPage(1), [dateSort]);
  useEffect(() => setSelectedIds([]), [view]);
  async function bulkReceive() {
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const selected = claims.filter((claim) => selectedIds.includes(claim.id));
      const result = await api("/api/claims/bulk-receive", {
        method: "POST",
        body: JSON.stringify({
          receivedDate: receiveDate.format("YYYY-MM-DD"),
          items: selected.map(({ id, version }) => ({ id, version })),
        }),
      });
      (result.claims || []).forEach(onClaimSaved);
      setSelectedIds((current) => current.filter((id) => !(result.claims || []).some((claim) => claim.id === id)));
      setBulkResult({ received: result.claims?.length || 0, failed: result.errors?.length || 0 });
      if (!result.errors?.length) setBulkOpen(false);
    } catch (err) {
      setBulkResult({ error: err.message });
    } finally {
      setBulkBusy(false);
    }
  }
  const metric = (icon, value, label, tone) => (
    <article>
      <span className={`metric-icon ${tone}`}>{icon}</span>
      <Statistic title={label} value={value} groupSeparator="," />
    </article>
  );
  return (
    <>
      <div className="top-actions">
        <AppButton
          className="secondary"
          icon={<FileText size={17} />}
          onClick={() => setReportOpen(true)}
        >
          Reports
        </AppButton>
        {canManage && (
          <AppButton
            className="primary"
            icon={<Plus size={17} />}
            onClick={() => setClaimForm({})}
          >
            New Claim
          </AppButton>
        )}
      </div>
      <section className="metrics">
        {metric(
          <PackageOpen size={20} />,
          claims.filter((claim) => !["complete", "cancelled"].includes(claim.status)).length,
          "Active Claims",
          "amber",
        )}
        {metric(<Truck size={20} />, counts.reported, "In Collection", "blue")}
        {metric(
          <BatteryCharging size={20} />,
          counts.arrived,
          "Warehouse Inspecting",
          "violet",
        )}
        {metric(<Check size={20} />, counts.complete, "Completed", "green")}
      </section>
      <section className="surface workspace">
        <div className="list-toolbar">
          <StatusTabs
            label="Claim Progress"
            activeKey={view}
            onChange={setView}
            items={claimViews.map((item) => ({
              ...item,
              count: counts[item.id],
            }))}
          />
          <div className="workspace-list-actions">
            <Tooltip title="Scan QR Code Or Barcode">
              <AppButton
                className="secondary mobile-scan-button"
                icon={<ScanLine size={18} />}
                aria-label="Scan QR Code Or Barcode"
                onClick={() => setScannerOpen(true)}
              />
            </Tooltip>
            <SearchInput
              className="app-search-input workspace-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Case"
              allowClear
            />
          </div>
        </div>
        {scannerOpen && (
          <Suspense fallback={null}>
            <MobileCodeScanner
              open={scannerOpen}
              onClose={() => setScannerOpen(false)}
              onScanned={(value) => {
                setQuery(value);
                setPage(1);
              }}
            />
          </Suspense>
        )}
        <div className="progress-subfilters-react claims-filter-row">
          {!!subfilters.length && (
            <Segmented
              value={subfilter}
              onChange={setSubfilter}
              options={subfilters.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
            />
          )}
          <Select
            className="claims-date-sort"
            value={dateSort}
            onChange={setDateSort}
            aria-label="Sort By Report Date"
            options={[
              { value: "desc", label: "Report Date: Newest" },
              { value: "asc", label: "Report Date: Oldest" },
            ]}
          />
        </div>
        {view === "reported" && canManage && (
          <div className="bulk-receive-bar">
            <Checkbox
              checked={allVisibleSelected}
              indeterminate={!allVisibleSelected && selectableVisible.some((claim) => selectedIds.includes(claim.id))}
              disabled={!selectableVisible.length}
              onChange={(event) => {
                const ids = selectableVisible.map((claim) => claim.id);
                setSelectedIds((current) => event.target.checked ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id)));
              }}
            >
              Select This Page
            </Checkbox>
            <span>{selectedIds.length.toLocaleString()} selected</span>
            <AppButton className="primary" disabled={!selectedIds.length} onClick={() => { setBulkResult(null); setBulkOpen(true); }}>
              Mark As Received
            </AppButton>
          </div>
        )}
        <div className="claim-list">
          {visible.map((c) => (
            <article className="claim-card" key={c.id}>
              {view === "reported" && canManage && (
                <Checkbox
                  className="claim-select"
                  checked={selectedIds.includes(c.id)}
                  disabled={c.status !== "reported" || !!c.warehouse?.receivedDate}
                  aria-label={`Select ${c.caseNumber || c.serial}`}
                  onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, c.id] : current.filter((id) => id !== c.id))}
                />
              )}
              <div className="claim-identity">
                <AppButton
                  className="serial-link"
                  title="Open Case Preview"
                  onClick={() => setSelectedClaim(c)}
                >
                  {c.serial}
                </AppButton>
                <div className="case-model">
                  {c.model || "Model Not Recorded"}
                </div>
                <div className="secondary-text">
                  Report Date: {shown(c.claimDate)}
                </div>
              </div>
              <div className="claim-party">
                <div className="customer">
                  {c.customer || c.dealerName || "Customer Not Recorded"}
                  {c.branchName && (
                    <small className="branch-code">{c.branchName}</small>
                  )}
                </div>
                <div className="case-area">{c.area || "Area Not Recorded"}</div>
                <div className="case-agent">
                  {c.salesperson || "Sales Agent Not Recorded"}
                </div>
              </div>
              <div className="stage-wrap">
                <div>
                  <div className="stage-title">{stageLabel(c.status)}</div>
                  <div className="stage-next">{stageDetail(c, view)}</div>
                </div>
              </div>
              {canManage && c.status !== "cancelled" && (
                <div className="row-actions">
                  <AppButton
                    className="secondary"
                    onClick={() => setWarehouseClaim(c)}
                  >
                    Warehouse Data
                  </AppButton>
                  <AppButton
                    className="secondary"
                    onClick={() => setAdminClaim(c)}
                  >
                    Admin Process
                  </AppButton>
                </div>
              )}
            </article>
          ))}
        </div>
        {!visible.length && (
          <div className="empty">
            <SearchIcon size={22} />
            <strong>No Claims Found</strong>
            <span>Try Another Search Or Status.</span>
          </div>
        )}
        <AppPagination
          page={page}
          total={filtered.length}
          pageSize={pageSize}
          onChange={setPage}
        />
      </section>
      {selectedClaim && (
        <CasePreview
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
          onEdit={
            canManage && selectedClaim.status !== "cancelled"
              ? () => {
                  setClaimForm(selectedClaim);
                  setSelectedClaim(null);
                }
              : null
          }
          onCancelClaim={canManage && selectedClaim.status !== "cancelled" ? () => setCancelClaim(selectedClaim) : null}
          onDelete={canManage ? () => setDeleteClaim(selectedClaim) : null}
        />
      )}
      {claimForm && (
        <ClaimForm
          claim={claimForm.id ? claimForm : null}
          claims={claims}
          onClose={() => setClaimForm(null)}
          onSaved={onClaimSaved}
        />
      )}
      {adminClaim && (
        <AdminProcess
          claim={adminClaim}
          onClose={() => setAdminClaim(null)}
          onSaved={onClaimSaved}
        />
      )}
      {warehouseClaim && (
        <WarehouseData
          claim={warehouseClaim}
          onClose={() => setWarehouseClaim(null)}
          onSaved={onClaimSaved}
        />
      )}
      {reportOpen && (
        <Suspense fallback={<div className="loading-block"><Spin size="large" /></div>}><ReportPanel claims={claims} onClose={() => setReportOpen(false)} /></Suspense>
      )}
      {deleteClaim && (
        <DeleteClaimDialog
          claim={deleteClaim}
          onCancel={() => setDeleteClaim(null)}
          onDeleted={(id) => {
            setDeleteClaim(null);
            setSelectedClaim(null);
            onClaimDeleted(id);
          }}
        />
      )}
      {cancelClaim && (
        <CancelClaimDialog
          claim={cancelClaim}
          onClose={() => setCancelClaim(null)}
          onCancelled={(claim) => {
            setCancelClaim(null);
            setSelectedClaim(null);
            onClaimSaved(claim);
            setView("cancelled");
          }}
        />
      )}
      <Modal
        title="Mark Cases As Received"
        open={bulkOpen}
        okText="Confirm Received"
        confirmLoading={bulkBusy}
        okButtonProps={{ disabled: !receiveDate || !selectedIds.length }}
        onOk={bulkReceive}
        onCancel={() => !bulkBusy && setBulkOpen(false)}
      >
        <p>Update {selectedIds.length.toLocaleString()} selected case{selectedIds.length === 1 ? "" : "s"} and move them to Warehouse Inspecting.</p>
        <label className="bulk-date-field">
          <span>Date Received</span>
          <DatePicker value={receiveDate} onChange={setReceiveDate} format="DD-MM-YYYY" allowClear={false} />
        </label>
        {bulkResult?.error && <Alert type="error" showIcon message={bulkResult.error} />}
        {bulkResult && !bulkResult.error && <Alert type={bulkResult.failed ? "warning" : "success"} showIcon message={`${bulkResult.received} received successfully${bulkResult.failed ? `; ${bulkResult.failed} could not be updated.` : "."}`} />}
      </Modal>
    </>
  );
}

function App() {
  const [session, setSession] = useState(undefined);
  const [claims, setClaims] = useState([]);
  const [page, setPage] = useState("claims");
  const [error, setError] = useState("");
  async function load(user) {
    setSession(user);
    if (!user) return;
    setPage(pagesForRole(user.role)[0].id);
    try {
      setClaims((await api("/api/claims")).claims || []);
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => {
    api("/api/session")
      .then((result) => load(result.user))
      .catch((err) => {
        setError(err.message);
        setSession(null);
      });
  }, []);
  useEffect(() => {
    if (!session) return;
    let active = true;
    const refresh = () =>
      api("/api/claims")
        .then((result) => {
          if (!active) return;
          const incoming = result.claims || [];
          setClaims((current) => {
            const unchanged =
              current.length === incoming.length &&
              current.every(
                (claim, index) =>
                  claim.id === incoming[index]?.id &&
                  claim.version === incoming[index]?.version,
              );
            return unchanged ? current : incoming;
          });
        })
        .catch(() => {});
    const timer = setInterval(refresh, 15000);
    const resume = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [session?.id]);
  async function signOut() {
    try {
      await api("/api/logout", { method: "POST", body: "{}" });
    } finally {
      setAuthToken("");
    }
    setSession(null);
    setClaims([]);
  }
  if (session === undefined)
    return (
      <div className="loading">
        <Spin size="large" description="Loading Battery Claim App...">
          <span className="loading-placeholder" />
        </Spin>
      </div>
    );
  if (!session) return <SignIn onSuccess={load} />;
  const allowed = pagesForRole(session.role);
  return (
    <div className="app">
      <header>
        <div className="brand">
          <img className="brand-logo" src={brandLogo} alt="Kai Shen" />
          <strong>Battery Claim App</strong>
        </div>
        <div className="account">
          <span>
            {session.name || session.username} <small>{session.role}</small>
          </span>
          <AppButton className="icon" onClick={signOut} title="Sign Out">
            <LogOut size={18} />
          </AppButton>
        </div>
      </header>
      <nav>
        <Tabs
          className="main-tabs"
          activeKey={page}
          onChange={setPage}
          items={allowed.map((item) => {
            const Icon = item.icon;
            return {
              key: item.id,
              label: (
                <>
                  <Icon />
                  <span>{item.label}</span>
                </>
              ),
            };
          })}
        />
      </nav>
      <main className="content">
        {error && (
          <Alert className="app-alert" type="error" showIcon message={error} />
        )}
        {page === "claims" ? (
          <Claims
            claims={claims}
            session={session}
            onClaimSaved={(claim) =>
              setClaims((current) => [
                claim,
                ...current.filter((item) => item.id !== claim.id),
              ])
            }
            onClaimDeleted={(id) =>
              setClaims((current) => current.filter((item) => item.id !== id))
            }
          />
        ) : page === "sales" ? (
          <SalesApprovals
            claims={claims}
            session={session}
            onClaimSaved={(claim) =>
              setClaims((current) => [
                claim,
                ...current.filter((item) => item.id !== claim.id),
              ])
            }
          />
        ) : (
          <Suspense
            fallback={
              <div className="loading-block">
                <Spin size="large" />
              </div>
            }
          >
            <ManagementDashboard
              claims={claims}
              session={session}
              CasePreviewComponent={CasePreview}
            />
          </Suspense>
        )}
      </main>
    </div>
  );
}

export default App;
