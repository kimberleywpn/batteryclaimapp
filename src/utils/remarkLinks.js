export const attachmentTitles = [
  "Battery Survey Form / Battery Investigation Checklist",
  "Invoice / Cash Bill Of Previous Battery Replacement",
  "Job Card",
  "Battery Test Result - Before Charging",
  "Battery Test Result - After Charging",
  "Warranty Card",
  "Photo Of Current Mileage",
  "Photo Of Claim Battery",
  "Photo Of Car (With Plate Number)",
];

export const remarksMaxLength = 10000;
export const attachmentLinksMaxLength = 10000;

export function isWebLink(value) {
  if (!/^https?:\/\/\S+$/i.test(value)) return false;
  try {
    const url = new URL(value);
    return Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function appendAttachmentLink(links, title, value) {
  const url = String(value || "").trim();
  if (!attachmentTitles.includes(title)) throw new Error("Select a document type.");
  if (!isWebLink(url)) throw new Error("Enter a valid http:// or https:// attachment URL.");
  const next = [String(links || "").trimEnd(), `${title}: ${url}`].filter(Boolean).join("\n");
  if (next.length > attachmentLinksMaxLength) throw new Error("Attachment Links can contain up to 10,000 characters.");
  return next;
}

export function remarkSegments(value) {
  return String(value || "").split(/\r?\n/).map((line) => {
    const titled = line.match(/^(.+?):[ \t]*(https?:\/\/\S+)[ \t]*$/i);
    if (titled && !/https?:\/\//i.test(titled[1]) && isWebLink(titled[2])) return [{ text: titled[1], url: titled[2] }];
    const segments = [];
    let start = 0;
    for (const match of line.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
      let url = match[0].replace(/[.,;!?]+$/, "");
      // Leave enclosing punctuation in the remark, but retain balanced URL parentheses.
      while (url.endsWith(")") && (url.match(/\)/g) || []).length > (url.match(/\(/g) || []).length) url = url.slice(0, -1);
      if (!isWebLink(url)) continue;
      if (match.index > start) segments.push({ text: line.slice(start, match.index) });
      segments.push({ text: "Open attachment", url });
      start = match.index + url.length;
    }
    if (start < line.length) segments.push({ text: line.slice(start) });
    return segments.length ? segments : [{ text: line }];
  });
}

export function attachmentLinkRows(value) {
  const rows = [];
  let pendingTitle = "";
  for (const line of remarkSegments(value)) {
    if (!line.some(part => part.url)) {
      const text = line.map(part => part.text).join("").trim();
      if (text) {
        pendingTitle = text.endsWith(":") || attachmentTitles.some(label => label.toLowerCase() === text.toLowerCase())
          ? text : "";
      }
      continue;
    }
    let prefix = "";
    for (const part of line) {
      if (!part.url) {
        prefix += part.text;
        continue;
      }
      let title = part.text === "Open attachment" ? prefix.trim() : part.text.trim();
      prefix = "";
      if (!title && pendingTitle) title = pendingTitle;
      pendingTitle = "";
      rows.push({ title: title.replace(/:\s*$/, "") || "Attachment", url: part.url });
    }
  }
  return rows;
}
