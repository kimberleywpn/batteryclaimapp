import { useRef, useState } from "react";
import { Alert, Input, message, Modal } from "antd";
import { Check } from "lucide-react";
import { api } from "../api";
import { AppButton } from "../components/AppControls";
import "./BulkApprovalDialog.css";

export default function BulkApprovalDialog({ claims, onClose, onClaimSaved }) {
  const [remaining, setRemaining] = useState(claims);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [errors, setErrors] = useState({});
  const running = useRef(false);

  async function approve() {
    if (running.current || !remaining.length) return;
    running.current = true;
    setBusy(true);
    setErrors({});
    setProcessed(0);
    const failures = [];
    const nextErrors = {};
    let approved = 0;
    for (const [index, claim] of remaining.entries()) {
      try {
        const result = await api(`/api/claims/${encodeURIComponent(claim.id)}/approval`, {
          method: "PUT",
          body: JSON.stringify({ version: claim.version, data: { decision: "approved", comments } }),
        });
        onClaimSaved(result.claim);
        approved += 1;
      } catch (err) {
        failures.push(claim);
        nextErrors[claim.id] = err.message;
      }
      setProcessed(index + 1);
    }
    setApprovedCount((current) => current + approved);
    setRemaining(failures);
    setErrors(nextErrors);
    setBusy(false);
    running.current = false;
    if (!failures.length) {
      message.success(`${approved} Case${approved === 1 ? "" : "s"} Approved`);
      onClose();
    }
  }

  return (
    <Modal
      title="Approve Selected Cases"
      open
      width={740}
      onCancel={() => !running.current && onClose()}
      closable={!busy}
      mask={{ closable: !busy }}
      keyboard={!busy}
      footer={[
        <AppButton key="cancel" className="secondary" disabled={busy} onClick={onClose}>{approvedCount ? "Close" : "Cancel"}</AppButton>,
        <AppButton key="approve" className="primary" loading={busy} disabled={busy || !remaining.length} onClick={approve}>
          {!busy && <Check size={16} />}
          {busy ? `Approving ${processed} / ${remaining.length}` : `Approve ${remaining.length} Case${remaining.length === 1 ? "" : "s"}`}
        </AppButton>,
      ]}
    >
      <p className="bulk-approval-summary">{remaining.length} selected case{remaining.length === 1 ? "" : "s"} will move to Settlement.</p>
      {Object.keys(errors).length > 0 && <Alert type="warning" showIcon title={`${approvedCount} approved; ${remaining.length} could not be approved.`} />}
      <div className="bulk-approval-list">
        {remaining.map((claim) => (
          <div className="bulk-approval-case" key={claim.id}>
            <div><strong>{claim.serial}</strong><span>{claim.salesperson}</span></div>
            <span>{claim.admin?.result || "No Result Recorded"}</span>
            {errors[claim.id] && <p role="alert">{errors[claim.id]}</p>}
          </div>
        ))}
      </div>
      <label className="bulk-approval-comments">
        <span>Comments (Optional)</span>
        <Input.TextArea value={comments} onChange={(event) => setComments(event.target.value.toUpperCase())} rows={3} maxLength={2000} disabled={busy} />
      </label>
    </Modal>
  );
}

