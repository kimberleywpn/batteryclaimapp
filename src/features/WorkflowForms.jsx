import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Collapse, Form, Image, Input, Modal, notification, Select, Upload as AntUpload } from "antd";
import { Paperclip, Plus, Save, Search as SearchIcon, X } from "lucide-react";
import { api } from "../api";
import { advanceFieldOnEnter, AppButton, AppDatePicker, AppFieldInput, SearchInput, TextArea } from "../components/AppControls";
import { completedMonthsBetween, shown, titleCase } from "../utils/claimFormatting";

const emptyIntake = {
  serial: "",
  claimDate: new Date().toISOString().slice(0, 10),
  crfNo: "",
  customer: "",
  dealerName: "",
  branchName: "",
  debtorCode: "",
  itemGroup: "",
  area: "",
  model: "",
  salesperson: "",
  invoiceNo: "",
  invoiceDate: "",
  itemDescription: "",
  batteryUsedMonths: "",
};
export function ClaimForm({ claim, claims = [], onClose, onSaved }) {
  const initialValues = claim
    ? Object.fromEntries(
        Object.keys(emptyIntake).map((key) => [key, claim[key] || ""]),
      )
    : emptyIntake;
  const [formApi] = Form.useForm();
  const [lookupState, setLookupState] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lookupRequest = useRef(null);
  const enteredSerial = Form.useWatch("serial", formApi);
  const duplicateClaims = useMemo(() => {
    const serial = String(enteredSerial || "").trim().toUpperCase();
    if (!serial) return [];
    return claims.filter(
      (item) =>
        item.id !== claim?.id &&
        String(item.serial || "").trim().toUpperCase() === serial,
    );
  }, [claims, claim?.id, enteredSerial]);
  useEffect(() => () => lookupRequest.current?.abort(), []);
  async function lookup() {
    const serial = String(formApi.getFieldValue("serial") || "").trim();
    if (!serial) return;
    lookupRequest.current?.abort();
    const controller = new AbortController();
    lookupRequest.current = controller;
    setLookupState("Looking Up Serial Number...");
    setError("");
    try {
      const result = await api(
        `/api/serial-lookup?serial=${encodeURIComponent(serial)}`,
        { signal: controller.signal },
      );
      if (
        controller.signal.aborted ||
        serial !== String(formApi.getFieldValue("serial") || "").trim()
      )
        return;
      const row = result.records?.[0];
      if (!row)
        return setLookupState(
          "No Matching Record. Enter The Details Manually.",
        );
      const current = formApi.getFieldsValue(true);
      const invoiceDate = String(row.invoiceDate || current.invoiceDate).slice(
        0,
        10,
      );
      formApi.setFieldsValue({
        customer: row.customerName || current.customer,
        dealerName: row.dealerName || current.dealerName,
        branchName: row.branchName || current.branchName,
        debtorCode: row.debtorCode || current.debtorCode,
        itemGroup: row.itemGroup || current.itemGroup,
        area: row.area || current.area,
        model: row.batteryModel || current.model,
        salesperson: row.salesAgent || current.salesperson,
        invoiceNo: row.invoiceNo || current.invoiceNo,
        invoiceDate,
        batteryUsedMonths: completedMonthsBetween(
          invoiceDate,
          current.claimDate,
        ),
        itemDescription: row.itemDescription || current.itemDescription,
      });
      setLookupState("Invoice Details Found. All Fields Remain Editable.");
    } catch (err) {
      if (err.name === "AbortError") return;
      setLookupState("");
      setError(err.message);
    } finally {
      if (lookupRequest.current === controller) lookupRequest.current = null;
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    const data = { ...emptyIntake, ...formApi.getFieldsValue(true) };
    try {
      const result = claim
        ? await api(`/api/claims/${claim.id}/intake`, {
            method: "PUT",
            body: JSON.stringify({ version: claim.version, data }),
          })
        : await api("/api/claims", {
            method: "POST",
            body: JSON.stringify(data),
          });
      onSaved(result.claim);
      onClose();
    } catch (err) {
      if (!err?.errorFields) setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const field = (label, name, { wide, type, required, ...options } = {}) => (
    <Form.Item
      className={wide ? "wide" : ""}
      label={label}
      name={name}
      required={required}
      rules={required ? [{ required: true, message: `Enter ${label}.` }] : []}
      normalize={
        type === "date" || type === "number"
          ? undefined
          : (value) => String(value || "").toUpperCase()
      }
    >
      {type === "date" ? (
        <AppDatePicker required={required} />
      ) : (
        <AppFieldInput name={name} type={type} {...options} />
      )}
    </Form.Item>
  );
  return (
    <Modal
      className="workflow-modal claim-intake-modal"
      open
      footer={null}
      closable={false}
      width={820}
      onCancel={() => !busy && onClose()}
      mask={{ closable: !busy }}
      destroyOnHidden
    >
      <Form
        className="data-dialog claim-intake-form"
        form={formApi}
        initialValues={initialValues}
        layout="vertical"
        noValidate
        onFinish={submit}
        onKeyDown={advanceFieldOnEnter}
        onValuesChange={(changed, values) => {
          if ("serial" in changed && lookupRequest.current) {
            lookupRequest.current.abort();
            lookupRequest.current = null;
            setLookupState("");
          }
          if ("invoiceDate" in changed || "claimDate" in changed) {
            formApi.setFieldValue(
              "batteryUsedMonths",
              completedMonthsBetween(values.invoiceDate, values.claimDate),
            );
          }
        }}
      >
        <AppButton
          type="button"
          className="sticky-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </AppButton>
        <div className="dialog-title">
          <span className="eyebrow">Claim Intake</span>
          <h2>{claim ? "Edit Claim Information" : "Report Battery Claim"}</h2>
        </div>
        <div className="form-layout">
          <Form.Item
            className="serial-lookup-field"
            label="Battery Serial Number"
            name="serial"
            required
            normalize={(value) => String(value || "").toUpperCase()}
            rules={[
              { required: true, message: "Enter Battery Serial Number." },
            ]}
          >
            <SearchInput
              className="app-search-input serial-search"
              onSearch={lookup}
              enterButton={<SearchIcon size={17} />}
              allowClear
              maxLength={100}
              autoFocus
            />
          </Form.Item>
          {field("Report Date", "claimDate", {
            type: "date",
            required: true,
          })}
          {field("CRF No.", "crfNo")}
          {lookupState && (
            <Alert
              className="app-alert lookup-state wide"
              type={
                lookupState.startsWith("Invoice Details Found")
                  ? "success"
                  : lookupState.startsWith("No Matching Record")
                    ? "warning"
                    : "info"
              }
              showIcon
              message={lookupState}
            />
          )}
          {duplicateClaims.length > 0 && (
            <Alert
              className="app-alert duplicate-claim-warning wide"
              type="warning"
              showIcon
              message={`Duplicate Serial Warning: ${duplicateClaims.length} Existing Claim${duplicateClaims.length === 1 ? "" : "s"} Found`}
              description={duplicateClaims
                .slice(0, 3)
                .map(
                  (item) =>
                    `${item.caseNumber || item.id} | ${shown(item.claimDate)} | ${titleCase(item.status)}`,
                )
                .join("\n")}
            />
          )}
          {field("Customer Name", "customer", { required: true })}
          {field("Area", "area", { required: true })}
          {field("Sales Agent", "salesperson", { required: true })}
          {field("Invoice No.", "invoiceNo")}
          {field("Invoice Date", "invoiceDate", { type: "date" })}
          {field("Battery Used Months", "batteryUsedMonths", {
            type: "number",
            min: 0,
            readOnly: true,
          })}
          {field("Battery Model", "model", { required: true })}
          {field("Brand", "itemGroup")}
          {field("Item Description", "itemDescription")}
        </div>
        {error && (
          <Alert className="app-alert" type="error" showIcon message={error} />
        )}
        <div className="dialog-actions">
          <AppButton className="secondary" onClick={onClose}>
            Cancel
          </AppButton>
          <AppButton className="primary" htmlType="submit" loading={busy}>
            {busy ? "Saving..." : claim ? "Save Changes" : "Create Claim"}
          </AppButton>
        </div>
      </Form>
    </Modal>
  );
}

const adminResults = [
  "Compensation Of Claims",
  "Loyalty Compensation",
  "Recharge & Returned (After Service)",
  "Recharged & Returned (New Battery)",
  "Reject & Return",
  "Rejected With Special Political Claim",
  "Rejected With Special Political Claim In Value",
  "Dispose",
];
const adminFieldNames = [
  "result",
  "wanNo",
  "replaceItem",
  "replaceSerialNo",
  "settleDate",
  "pendingReason",
  "claimDate",
  "batteryInstalledDate",
  "carModel",
  "vehicleRegistrationNo",
  "vehicleRegistrationDate",
  "mileage1",
  "mileage2",
  "directReplacedSerialNo",
  "remarks1",
];
export function AdminProcess({ claim, onClose, onSaved }) {
  const initialValues = Object.fromEntries(
    adminFieldNames.map((name) => [name, claim.admin?.[name] || ""]),
  );
  const [formApi] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const [attachmentLoading, setAttachmentLoading] = useState(true);
  const [attachments, setAttachments] = useState([]);
  const [previewImage, setPreviewImage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api(`/api/claims/${claim.id}/attachments`)
      .then((result) => active && setAttachments(result.attachments || []))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setAttachmentLoading(false));
    return () => { active = false; };
  }, [claim.id]);
  const approvalStatus =
    claim.approval?.decision === "approved"
      ? "Approved"
      : claim.approval?.decision === "review_requested"
        ? "Review Requested"
        : claim.status === "sales"
          ? "Pending Approval"
          : "Not Sent";
  const settlement =
    claim.status === "settlement" || claim.status === "complete";
  async function save(action) {
    setError("");
    if (attachmentLoading) {
      setError("Wait For Supporting Documents To Finish Loading.");
      return;
    }
    if (action === "submit" && !formApi.getFieldValue("result")) {
      formApi.setFields([
        { name: "result", errors: ["Select A Result Before Sending."] },
      ]);
      return;
    }
    if (action === "complete" && !formApi.getFieldValue("settleDate")) {
      formApi.setFields([
        { name: "settleDate", errors: ["Enter Settle Date."] },
      ]);
      return;
    }
    try {
      setBusy(true);
      const data = formApi.getFieldsValue(true);
      const result = await api(`/api/claims/${claim.id}/admin`, {
        method: "PUT",
        body: JSON.stringify({ version: claim.version, action, data, files: attachments }),
      });
      if (action === "submit") {
        notification.success({
          message: "Sent For Approval",
          description: `${claim.serial} Is Now Awaiting Sales Approval.`,
          placement: "topRight",
        });
      }
      onSaved(result.claim);
      onClose();
    } catch (err) {
      if (!err?.errorFields) setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const input = (label, name, { type, rules, ...props } = {}) => (
    <Form.Item
      label={label}
      name={name}
      rules={rules}
      normalize={
        type === "date" || type === "number"
          ? undefined
          : (value) => String(value || "").toUpperCase()
      }
    >
      {type === "date" ? (
        <AppDatePicker />
      ) : (
        <AppFieldInput name={name} type={type} {...props} />
      )}
    </Form.Item>
  );
  async function addAttachments(fileList) {
    setError("");
    const available = 8 - attachments.length;
    const selected = [...fileList].slice(0, available);
    if (selected.length < fileList.length) setError("Maximum 8 Attachments Per Case.");
    try {
      const added = await Promise.all(selected.map(fileAsAdminAttachment));
      const valid = added.filter((file) => file.size <= 5 * 1024 * 1024);
      if (valid.length !== added.length) setError("Attachments Over 5 MB Were Skipped.");
      setAttachments((current) => {
        const next = [...current, ...valid].slice(0, 8);
        const total = next.reduce((sum, file) => sum + (file.size || Math.ceil(file.base64.length * 0.75)), 0);
        if (total > 20 * 1024 * 1024) {
          setError("Maximum Total Attachment Size Is 20 MB Per Case.");
          return current;
        }
        return next;
      });
    } catch (err) {
      setError(err.message);
    }
  }
  const attachmentFileList = attachments.map((file) => ({
    uid: file.id,
    name: file.name,
    status: "done",
    size: file.size || Math.ceil(file.base64.length * 0.75),
    type: file.type,
    url: `data:${file.type};base64,${file.base64}`,
  }));
  return (
    <Modal
      className="workflow-modal admin-process-modal"
      open
      footer={null}
      closable={false}
      width={820}
      onCancel={() => !busy && onClose()}
      mask={{ closable: !busy }}
      destroyOnHidden
    >
      <Form
        className="data-dialog admin-dialog"
        form={formApi}
        initialValues={initialValues}
        layout="vertical"
        autoComplete="off"
        noValidate
        onKeyDown={advanceFieldOnEnter}
      >
        <AppButton
          type="button"
          className="sticky-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </AppButton>
        <div className="panel-heading">
          <span className="eyebrow">Admin Process</span>
          <h2>
            <span>{claim.serial}</span>
            <i aria-hidden="true" />
            <span>{shown(claim.model)}</span>
          </h2>
          <p>
            {shown(claim.dealerName || claim.customer)} | {shown(claim.area)} |{" "}
            {shown(claim.salesperson)}
          </p>
        </div>
        <fieldset className="admin-section">
          <legend>Result Review</legend>
          <div className="review-row">
            <Form.Item
              label="Result"
              name="result"
              rules={[{ required: true, message: "Select A Result." }]}
            >
              <Select
                className="form-select"
                autoComplete="new-password"
                options={adminResults.map((value) => ({ value, label: value }))}
                placeholder="Select Result"
                allowClear
              />
            </Form.Item>
            <span className="approval-state">
              Approval: <strong>{approvalStatus}</strong>
            </span>
            {claim.status !== "complete" && (
              <AppButton
                type="button"
                className="primary"
                disabled={busy || attachmentLoading}
                onClick={() => save("submit")}
              >
                Send For Approval
              </AppButton>
            )}
          </div>
        </fieldset>
        <fieldset className="admin-section">
          <legend>Settlement</legend>
          <div className="admin-fields">
            {input("WAN No.", "wanNo")}
            {input("Replace Item", "replaceItem")}
            {input("Replace Serial No.", "replaceSerialNo")}
            {input("Settle Date", "settleDate", { type: "date" })}
            <Form.Item
              className="wide"
              label="Pending With Reason"
              name="pendingReason"
              normalize={(value) => String(value || "").toUpperCase()}
            >
              <TextArea rows={3} />
            </Form.Item>
          </div>
        </fieldset>
        <Collapse
          className="additional-details"
          items={[
            {
              key: "additional",
              label: "Additional Claim Details",
              extra: <small>Optional</small>,
              children: (
                <div className="admin-fields">
                  {input("Claim Date", "claimDate", { type: "date" })}
                  {input("Battery Installed Date", "batteryInstalledDate", {
                    type: "date",
                  })}
                  {input("Car Model / Variant", "carModel")}
                  {input("Vehicle Reg. Number", "vehicleRegistrationNo")}
                  {input("Vehicle Reg. Date", "vehicleRegistrationDate", {
                    type: "date",
                  })}
                  {input("Prev Installed Mileage", "mileage1", {
                    type: "number",
                    min: 0,
                  })}
                  {input("Current Mileage", "mileage2", {
                    type: "number",
                    min: 0,
                  })}
                  {input("Direct Replaced S/N", "directReplacedSerialNo")}
                  <Form.Item
                    className="wide"
                    label="Remarks"
                    name="remarks1"
                    normalize={(value) => String(value || "").toUpperCase()}
                  >
                    <TextArea rows={2} />
                  </Form.Item>
                </div>
              ),
            },
          ]}
        />
        <section className="upload-section admin-attachments">
          <div className="upload-heading attachment-heading">
            <div>
              <strong><Paperclip size={16} /> Supporting Documents</strong>
              <span>Up To 8 Files, 5 MB Each, 20 MB Total</span>
            </div>
            <span>{attachments.length} / 8</span>
          </div>
          <AntUpload
            accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
            multiple
            className="claim-photo-upload"
            listType="picture-card"
            fileList={attachmentFileList}
            onPreview={(file) => {
              const url = file.url || file.thumbUrl || "";
              if (file.type?.startsWith("image/")) {
                setPreviewImage(url);
                return;
              }
              window.open(url, "_blank", "noopener,noreferrer");
            }}
            beforeUpload={(file, files) => {
              if (file.uid === files[0]?.uid) addAttachments(files);
              return AntUpload.LIST_IGNORE;
            }}
            onRemove={(file) => {
              setAttachments((current) => current.filter((item) => item.id !== file.uid));
              return false;
            }}
          >
            {attachments.length < 8 && (
              <AppButton type="button" className="ant-upload-trigger" disabled={attachmentLoading || busy}>
                <Plus size={18} />
                <span>Upload</span>
              </AppButton>
            )}
          </AntUpload>
        </section>
        {error && (
          <Alert className="app-alert" type="error" showIcon message={error} />
        )}
        <div className="dialog-actions">
          <AppButton className="secondary" onClick={onClose}>
            Cancel
          </AppButton>
          <AppButton
            className="primary"
            loading={busy}
            disabled={attachmentLoading}
            onClick={() =>
              save(
                claim.status === "complete"
                  ? "save-details"
                  : settlement
                    ? "draft"
                    : "save-details",
              )
            }
          >
            Save Details
          </AppButton>
          {settlement && claim.status !== "complete" && (
            <AppButton
              className="primary"
              loading={busy}
              disabled={attachmentLoading}
              onClick={() => save("complete")}
            >
              Complete Claim
            </AppButton>
          )}
        </div>
      </Form>
      {previewImage && (
        <Image
          styles={{ root: { display: "none" } }}
          preview={{
            open: true,
            onOpenChange: (open) => !open && setPreviewImage(""),
          }}
          src={previewImage}
        />
      )}
    </Modal>
  );
}

const warehouseFieldNames = [
  "receivedDate",
  "firstTestDate",
  "secondTestDate",
  "inspectionDate",
  "batchCode",
  "productDate",
  "judgment",
  "preOcv",
  "preCca",
  "postOcv",
  "postCca",
  "loadTestVoltage",
  "loadTestResult",
  "hydrometer",
  "result",
  "factory",
];
const fileAsPhoto = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        base64: String(reader.result).split(",")[1],
      });
    reader.onerror = () => reject(new Error(`Could Not Read ${file.name}`));
    reader.readAsDataURL(file);
  });
const fileAsAdminAttachment = async (file) => {
  if (!/\.(pdf|jpe?g|png|webp|docx|xlsx)$/i.test(file.name))
    throw new Error("Use PDF, JPG, PNG, WebP, DOCX Or XLSX Files.");
  let uploadFile = file;
  if (file.type.startsWith("image/") && typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (blob)
      uploadFile = new File(
        [blob],
        file.name.replace(/\.[^.]+$/, ".jpg"),
        { type: "image/jpeg" },
      );
  }
  const encoded = await fileAsPhoto(uploadFile);
  return { ...encoded, size: uploadFile.size };
};
export function WarehouseData({ claim, onClose, onSaved }) {
  const initialValues = Object.fromEntries(
    warehouseFieldNames.map((name) => [name, claim.warehouse?.[name] || ""]),
  );
  const [formApi] = Form.useForm();
  const [photos, setPhotos] = useState({ battery: [], test: [] });
  const [previewImage, setPreviewImage] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api(`/api/claims/${claim.id}/photos`)
      .then((files) => {
        if (active)
          setPhotos({ battery: files.battery || [], test: files.test || [] });
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [claim.id]);
  async function addPhotos(kind, fileList) {
    setError("");
    const files = [...fileList].filter((file) =>
      file.type.startsWith("image/"),
    );
    const valid = files.filter((file) => file.size <= 10 * 1024 * 1024);
    if (valid.length !== files.length)
      setError("Photos Over 10 MB Were Skipped.");
    try {
      const added = await Promise.all(valid.map(fileAsPhoto));
      setPhotos((current) => ({
        ...current,
        [kind]: [...current[kind], ...added].slice(0, 8),
      }));
    } catch (err) {
      setError(err.message);
    }
  }
  function removePhoto(kind, id) {
    Modal.confirm({
      title: "Delete Photo?",
      content: "This Photo Will Be Removed When You Save The Warehouse Data.",
      okText: "Delete Photo",
      cancelText: "Keep Photo",
      okButtonProps: { danger: true },
      onOk: () =>
        setPhotos((current) => ({
          ...current,
          [kind]: current[kind].filter((photo) => photo.id !== id),
        })),
    });
    return false;
  }
  async function submit() {
    setBusy(true);
    setError("");
    const data = formApi.getFieldsValue(true);
    try {
      const result = await api(`/api/claims/${claim.id}/warehouse`, {
        method: "PUT",
        body: JSON.stringify({
          version: claim.version,
          data,
          files: photos,
        }),
      });
      onSaved(result.claim);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const input = (label, name, { type, ...props } = {}) => (
    <Form.Item
      label={label}
      name={name}
      normalize={
        type === "date" || type === "number"
          ? undefined
          : (value) => String(value || "").toUpperCase()
      }
    >
      {type === "date" ? (
        <AppDatePicker />
      ) : (
        <AppFieldInput name={name} type={type} {...props} />
      )}
    </Form.Item>
  );
  const photoGroup = (title, kind) => {
    const fileList = photos[kind].map((photo) => ({
      uid: photo.id,
      name: photo.name,
      status: "done",
      size: photo.size || Math.ceil(photo.base64.length * 0.75),
      type: photo.type,
      url: `data:${photo.type};base64,${photo.base64}`,
    }));
    return (
      <section className="upload-section">
        <div className="upload-heading attachment-heading">
          <div>
            <strong>{title}</strong>
            <span>Up To 8 Photos, 10 MB Each</span>
          </div>
          <span>{fileList.length} / 8</span>
        </div>
        <AntUpload
          className="claim-photo-upload"
          accept="image/*"
          multiple
          listType="picture-card"
          fileList={fileList}
          beforeUpload={(file, files) => {
            if (file.uid === files[0]?.uid) addPhotos(kind, files);
            return AntUpload.LIST_IGNORE;
          }}
          onPreview={(file) => {
            const url = file.url || file.thumbUrl || "";
            if (file.type?.startsWith("image/")) setPreviewImage(url);
          }}
          onRemove={(file) => {
            removePhoto(kind, file.uid);
            return false;
          }}
        >
          {fileList.length >= 8 ? null : (
            <AppButton
              className="ant-upload-trigger"
              type="button"
              disabled={busy}
            >
              <Plus size={18} />
              <span>Upload</span>
            </AppButton>
          )}
        </AntUpload>
      </section>
    );
  };
  return (
    <>
      <Modal
        className="workflow-modal warehouse-data-modal"
        open
        footer={null}
        closable={false}
        width={820}
        onCancel={() => !busy && onClose()}
        mask={{ closable: !busy }}
        destroyOnHidden
      >
        <Form
          className="data-dialog warehouse-dialog"
          form={formApi}
          initialValues={initialValues}
          layout="vertical"
          noValidate
          onFinish={submit}
          onKeyDown={advanceFieldOnEnter}
        >
          <div className="warehouse-top-actions">
            <AppButton
              type="button"
              className="warehouse-top-save"
              onClick={() => formApi.submit()}
              disabled={busy}
              loading={busy}
              title="Save Warehouse Data"
              aria-label="Save Warehouse Data"
            >
              {!busy && <Save size={20} />}
            </AppButton>
            <AppButton
              type="button"
              className="sticky-close"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
            >
              <X size={20} />
            </AppButton>
          </div>
          <div className="panel-heading">
            <span className="eyebrow">Warehouse Data</span>
            <h2>
              <span>{claim.serial}</span>
              <i aria-hidden="true" />
              <span>{shown(claim.model)}</span>
            </h2>
            <p>
              {shown(claim.dealerName || claim.customer)} | {shown(claim.area)}{" "}
              | {shown(claim.salesperson)}
            </p>
          </div>
          <div className="warehouse-fields">
            <div className="warehouse-row">
              {input("Date Received", "receivedDate", { type: "date" })}
              <Form.Item label="Battery Model">
                <Input value={claim.model || ""} readOnly />
              </Form.Item>
              <Form.Item label="Serial Number">
                <Input value={claim.serial} readOnly />
              </Form.Item>
            </div>
            <div className="warehouse-row">
              {input("Battery Batch / Code", "batchCode")}
              {input("Production Date", "productDate")}
              {input("Factory", "factory")}
            </div>
            <fieldset className="test-box">
              <legend>Pre-Charge Data</legend>
              {input("First Test Date", "firstTestDate", { type: "date" })}
              {input("OCV (V)", "preOcv", {
                type: "number",
                min: 0,
                step: "0.01",
              })}
              {input("CCA (A)", "preCca", { type: "number", min: 0, step: 1 })}
            </fieldset>
            <fieldset className="test-box">
              <legend>After-Charge Data (12 Hours)</legend>
              {input("Second Test Date", "secondTestDate", { type: "date" })}
              {input("OCV (V)", "postOcv", {
                type: "number",
                min: 0,
                step: "0.01",
              })}
              {input("CCA (A)", "postCca", { type: "number", min: 0, step: 1 })}
            </fieldset>
            <fieldset className="test-box load-test-box">
              <legend>Load Test Data</legend>
              {input("Load Test (V)", "loadTestVoltage", {
                type: "number",
                min: 0,
                step: "0.01",
              })}
              {input("Result", "loadTestResult")}
            </fieldset>
            <div className="warehouse-row">
              {input("Judgement Result", "judgment")}
              {input("Hydrometer", "hydrometer")}
              {input("Result", "result")}
            </div>
            {photoGroup("Battery Photos", "battery")}
            {photoGroup("Test Result Photos", "test")}
          </div>
          {error && (
            <Alert
              className="app-alert"
              type="error"
              showIcon
              message={error}
            />
          )}
          <div className="dialog-actions">
            <AppButton className="secondary" onClick={onClose}>
              Cancel
            </AppButton>
            <AppButton className="primary" htmlType="submit" loading={busy}>
              {busy ? "Loading..." : "Save Warehouse Data"}
            </AppButton>
          </div>
        </Form>
      </Modal>
      {previewImage && (
        <Image
          styles={{ root: { display: "none" } }}
          preview={{
            open: true,
            onOpenChange: (open) => !open && setPreviewImage(""),
          }}
          src={previewImage}
        />
      )}
    </>
  );
}

export function ApprovalForm({ claim, onClose, onSaved, canApprove = true }) {
  const existing = claim.approval || {};
  const initialValues = {
    decision: ["approved", "review_requested"].includes(existing.decision)
      ? existing.decision
      : "",
    comments: ["approved", "review_requested"].includes(existing.decision)
      ? existing.comments || ""
      : "",
  };
  const [formApi] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const viewOnly = claim.status !== "sales" || !canApprove;
  async function submit(values) {
    setBusy(true);
    setError("");
    try {
      const result = await api(`/api/claims/${claim.id}/approval`, {
        method: "PUT",
        body: JSON.stringify({
          version: claim.version,
          data: values,
        }),
      });
      notification.success({
        message:
          values.decision === "approved"
            ? "Result Approved"
            : "Admin Review Requested",
        description:
          values.decision === "approved"
            ? `${claim.serial} Is Ready For Settlement.`
            : `${claim.serial} Has Been Returned For Admin Review.`,
        placement: "topRight",
      });
      onSaved(result.claim);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      className="workflow-modal sales-approval-modal"
      open
      footer={null}
      closable={false}
      width={820}
      onCancel={() => !busy && onClose()}
      mask={{ closable: !busy }}
      destroyOnHidden
    >
      <Form
        className="data-dialog approval-dialog"
        form={formApi}
        initialValues={initialValues}
        layout="vertical"
        noValidate
        onFinish={submit}
        onKeyDown={advanceFieldOnEnter}
      >
        <AppButton
          type="button"
          className="sticky-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </AppButton>
        <div className="panel-heading">
          <span className="eyebrow">Salesperson Approval</span>
          <h2>
            <span>{claim.serial}</span>
            <i aria-hidden="true" />
            <span>{shown(claim.model)}</span>
          </h2>
          <p>
            {shown(claim.dealerName || claim.customer)} | {shown(claim.area)} |{" "}
            {shown(claim.salesperson)}
          </p>
        </div>
        <div className="approval-result">
          <span>Result</span>
          <strong>{shown(claim.admin?.result)}</strong>
        </div>
        <div className="approval-fields">
          <Form.Item
            label="Decision"
            name="decision"
            required={!viewOnly}
            rules={
              viewOnly
                ? []
                : [{ required: true, message: "Select A Decision." }]
            }
          >
            <Select
              className="form-select"
              disabled={viewOnly}
              placeholder="Select Decision"
              options={[
                { value: "approved", label: "Approve Final Result" },
                { value: "review_requested", label: "Request Admin Review" },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Comments"
            name="comments"
            normalize={(value) => String(value || "").toUpperCase()}
          >
            <TextArea rows={4} readOnly={viewOnly} />
          </Form.Item>
        </div>
        {error && (
          <Alert className="app-alert" type="error" showIcon message={error} />
        )}
        <div className="dialog-actions">
          <AppButton type="button" className="secondary" onClick={onClose}>
            {viewOnly ? "Close" : "Cancel"}
          </AppButton>
          {!viewOnly && (
            <AppButton
              className="primary"
              htmlType="submit"
              disabled={busy}
              loading={busy}
            >
              {busy ? "Saving..." : "Submit Decision"}
            </AppButton>
          )}
        </div>
      </Form>
    </Modal>
  );
}
