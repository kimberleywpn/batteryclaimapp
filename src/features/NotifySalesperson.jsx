import { useMemo, useState } from "react";
import { Alert, Empty, Input, message, Modal, Tooltip } from "antd";
import { Copy, FileText, Send } from "lucide-react";
import dayjs from "dayjs";
import { AppButton } from "../components/AppControls";
import { pendingBySalesperson, salespersonMessage } from "../utils/salesNotifications";
import "./NotifySalesperson.css";

function readPreferences(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).filter(([, entry]) => typeof entry?.preparedAt === "string").map(([name, entry]) => [name, { preparedAt: entry.preparedAt }]))
      : {};
  } catch {
    return {};
  }
}

export default function NotifySalesperson({ claims, session }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [copyError, setCopyError] = useState(false);
  const [copying, setCopying] = useState(false);
  const storageKey = `celltrack_sales_reminders_v1:${session.id || session.username}`;
  const [preferences, setPreferences] = useState(() => readPreferences(storageKey));
  const groups = useMemo(() => pendingBySalesperson(claims), [claims]);
  if (!["owner", "admin"].includes(session.role)) return null;

  function rememberPrepared(key) {
    const next = { ...preferences, [key]: { preparedAt: new Date().toISOString() } };
    setPreferences(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setError("Browser storage is unavailable. Prepared times will not be kept after closing this page.");
    }
  }
  function generateMessage(group) {
    setError("");
    setCopyError(false);
    setPreview({ ...group, text: salespersonMessage(group, window.location.href) });
  }
  async function copyMessage() {
    if (!preview || copying) return;
    setError(""); setCopyError(false); setCopying(true);
    try {
      await navigator.clipboard.writeText(preview.text);
      rememberPrepared(preview.key);
      message.success("Message Copied");
    } catch {
      setCopyError(true);
    } finally { setCopying(false); }
  }
  return (
    <>
      <AppButton className="secondary" onClick={() => { setError(""); setOpen(true); }}>
        <Send size={16} /> Notify Salesperson
      </AppButton>
      <Modal title="Notify Salesperson" open={open} onCancel={() => { if (!copying) { setOpen(false); setPreview(null); } }} footer={null} width={820} className="notify-sales-modal">
        {error && <Alert type="warning" showIcon title={error} />}
        {!groups.length ? <Empty description="No Cases Awaiting Sales Review" /> : (
          <div className="notify-sales-list">
            {groups.map((group) => {
              const preparedAt = preferences[group.key]?.preparedAt;
              const prepared = preparedAt && dayjs(preparedAt);
              return (
                <div className="notify-sales-row" key={group.key}>
                  <div className="notify-sales-person">
                    <strong>{group.name}</strong>
                    <span>{group.count.toLocaleString()} awaiting review</span>
                    <Tooltip title="Prepared on this browser. Sending and delivery are not confirmed.">
                      <small>{prepared?.isValid() ? `Last prepared: ${prepared.format("DD MMM YYYY, h:mm A")}` : "Not prepared on this browser"}</small>
                    </Tooltip>
                  </div>
                  <div className="notify-sales-actions">
                    <AppButton className="primary" aria-label={`Generate message for ${group.name}`} onClick={() => generateMessage(group)}><FileText size={16} /> Generate Message</AppButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
      <Modal title="Message Preview" open={Boolean(preview)} zIndex={1100} width={640} closable={!copying} keyboard={!copying} mask={{ closable: !copying }} onCancel={() => !copying && setPreview(null)} footer={<><AppButton className="secondary" disabled={copying} onClick={() => setPreview(null)}>Close</AppButton><AppButton className="primary" aria-label="Copy Message" loading={copying} disabled={!preview || copying} onClick={copyMessage}><Copy size={16} />Copy Message</AppButton></>}>
        <p className="notify-sales-preview-person"><strong>{preview?.name}</strong> · {preview?.count.toLocaleString()} awaiting review</p>
        {copyError && <Alert className="notify-sales-copy-error" type="warning" showIcon title="Automatic copying is unavailable. Select and copy the message below." />}
        <Input.TextArea readOnly value={preview?.text || ""} rows={6} onFocus={event => { if (copyError) event.target.select(); }} aria-label="Summary message preview" />
      </Modal>
    </>
  );
}
