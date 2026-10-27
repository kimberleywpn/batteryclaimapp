import { useMemo, useState } from "react";
import { Alert, Empty, Input, message, Modal, Tooltip } from "antd";
import { Copy, MessageCircle, Send } from "lucide-react";
import dayjs from "dayjs";
import { AppButton } from "../components/AppControls";
import { pendingBySalesperson, salespersonMessage, whatsappUrl } from "../utils/salesNotifications";
import "./NotifySalesperson.css";

function readPreferences(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export default function NotifySalesperson({ claims, session }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [copyFallback, setCopyFallback] = useState("");
  const storageKey = `celltrack_sales_reminders_v1:${session.id || session.username}`;
  const [preferences, setPreferences] = useState(() => readPreferences(storageKey));
  const groups = useMemo(() => pendingBySalesperson(claims), [claims]);
  if (!["owner", "admin"].includes(session.role)) return null;

  function remember(key, changes) {
    const next = { ...preferences, [key]: { ...preferences[key], ...changes } };
    setPreferences(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setError("Browser storage is unavailable. Phone numbers and prepared times will not be kept after closing this page.");
    }
  }
  async function copyMessage(group) {
    setError("");
    const text = salespersonMessage(group, window.location.href);
    try {
      await navigator.clipboard.writeText(text);
      remember(group.key, { preparedAt: new Date().toISOString() });
      message.success("Summary Message Copied");
    } catch {
      setCopyFallback(text);
    }
  }
  function openWhatsApp(group) {
    setError("");
    try {
      const href = whatsappUrl(preferences[group.key]?.phone, salespersonMessage(group, window.location.href));
      const popup = window.open(href, "_blank");
      if (!popup) {
        setError("WhatsApp could not open. Allow popups for this site or use Copy Message.");
        return;
      }
      popup.opener = null;
      remember(group.key, { preparedAt: new Date().toISOString() });
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <>
      <AppButton className="secondary" onClick={() => { setError(""); setOpen(true); }}>
        <Send size={16} /> Notify Salesperson
      </AppButton>
      <Modal title="Notify Salesperson" open={open} onCancel={() => setOpen(false)} footer={null} width={820} className="notify-sales-modal">
        {error && <Alert type="warning" showIcon title={error} />}
        {!groups.length ? <Empty description="No Cases Awaiting Sales Review" /> : (
          <div className="notify-sales-list">
            {groups.map((group) => {
              const contact = preferences[group.key] || {};
              const prepared = contact.preparedAt && dayjs(contact.preparedAt);
              return (
                <div className="notify-sales-row" key={group.key}>
                  <div className="notify-sales-person">
                    <strong>{group.name}</strong>
                    <span>{group.count.toLocaleString()} awaiting review</span>
                    <Tooltip title="Prepared on this browser. Sending and delivery are not confirmed.">
                      <small>{prepared?.isValid() ? `Last prepared: ${prepared.format("DD MMM YYYY, h:mm A")}` : "Not prepared on this browser"}</small>
                    </Tooltip>
                  </div>
                  <label className="notify-sales-phone">
                    <span>WhatsApp Number (Optional)</span>
                    <Input type="tel" autoComplete="off" maxLength={24} placeholder="+60123456789" value={contact.phone || ""} aria-label={`WhatsApp number for ${group.name}`} onChange={(event) => remember(group.key, { phone: event.target.value })} />
                  </label>
                  <div className="notify-sales-actions">
                    <Tooltip title={`Copy summary for ${group.name}`}>
                      <AppButton className="secondary" aria-label={`Copy message for ${group.name}`} onClick={() => copyMessage(group)}><Copy size={16} /> Copy Message</AppButton>
                    </Tooltip>
                    <AppButton className="primary" aria-label={`Open WhatsApp for ${group.name}`} onClick={() => openWhatsApp(group)}><MessageCircle size={16} /> Open WhatsApp</AppButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
      <Modal title="Copy Summary Message" open={Boolean(copyFallback)} onCancel={() => setCopyFallback("")} footer={<AppButton className="secondary" onClick={() => setCopyFallback("")}>Close</AppButton>}>
        <Input.TextArea readOnly value={copyFallback} rows={6} autoFocus onFocus={(event) => event.target.select()} aria-label="Summary message" />
      </Modal>
    </>
  );
}

