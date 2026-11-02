import { useState } from "react";
import { Form, Input, Select } from "antd";
import { AppButton } from "./AppControls";
import { appendAttachmentLink, attachmentLinkRows, attachmentTitles, remarkSegments } from "../utils/remarkLinks";
import "./RemarkLinks.css";

export function RemarksContent({ value, separateLinks = false }) {
  if (separateLinks) {
    return (
      <div className="remarks-content attachment-link-list">
        {attachmentLinkRows(value).map((row, index) => (
          <div className="attachment-link-row" key={index}>
            <span className="attachment-link-title">{row.title}</span>
            <a href={row.url} aria-label={`Open Attachment: ${row.title}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open Attachment</a>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="remarks-content">
      {remarkSegments(value).map((line, lineIndex) => (
        <div className="remarks-line" key={lineIndex}>
          {line.map((part, index) => part.url ? (
            <a key={index} href={part.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
              {part.text}
            </a>
          ) : <span key={index}>{part.text}</span>)}
        </div>
      ))}
    </div>
  );
}

export function AttachmentLinkEditor({ formApi, disabled }) {
  const [title, setTitle] = useState();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  function addLink() {
    try {
      formApi.setFieldValue("attachmentLinks", appendAttachmentLink(formApi.getFieldValue("attachmentLinks"), title, url));
      setUrl("");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <Form.Item className="wide remark-link-editor" label="Add Link" validateStatus={error ? "error" : undefined} help={error || "Original files stay on your website. Save Details to keep these links."}>
      <div className="remark-link-controls">
        <Select aria-label="Attachment document type" placeholder="Select document type" value={title} onChange={setTitle} options={attachmentTitles.map(value => ({ value, label: value }))} disabled={disabled} />
        <Input aria-label="Attachment URL" placeholder="Paste attachment URL" value={url} onChange={event => setUrl(event.target.value)} disabled={disabled} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <AppButton htmlType="button" onClick={addLink} disabled={disabled}>Add Link</AppButton>
      </div>
    </Form.Item>
  );
}
