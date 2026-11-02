import test from "node:test";
import assert from "node:assert/strict";
import { appendAttachmentLink, attachmentLinkRows, attachmentTitles, remarkSegments } from "./remarkLinks.js";

const url = `https://kaishen.com.my/index.php?gf-download=2026%2F11%2FPhoto%20Of%20Current%20Mileage.jpg&form-id=17&field-id=36&entry-id=27479&hash=${"AbC123".repeat(11)}`;

test("titled attachment links keep signed URLs and existing remarks exactly", () => {
  const remarks = appendAttachmentLink("Existing note", "Photo Of Current Mileage", url);
  assert.equal(remarks, `Existing note\nPhoto Of Current Mileage: ${url}`);
  assert.deepEqual(remarkSegments(remarks), [[{ text: "Existing note" }], [{ text: "Photo Of Current Mileage", url }]]);
  const nineLinks = attachmentTitles.reduce((text, title) => appendAttachmentLink(text, title, url), "");
  assert.ok(nineLinks.length > 2000);
  assert.equal(remarkSegments(nineLinks).length, 9);
});

test("bare URLs are clickable without consuming surrounding notes or punctuation", () => {
  assert.deepEqual(remarkSegments(`See (${url}) please.\n\nKeep note`), [
    [{ text: "See (" }, { text: "Open attachment", url }, { text: ") please." }],
    [{ text: "" }], [{ text: "Keep note" }],
  ]);
  assert.equal(remarkSegments("See https://example.com/a(b). then https://example.com/two")[0][1].url, "https://example.com/a(b)");
  assert.deepEqual(remarkSegments("https://example.com/one https://example.com/two")[0].filter(part => part.url).map(part => part.url), ["https://example.com/one", "https://example.com/two"]);
});

test("non-web schemes, credential URLs and malformed links cannot become attachment links", () => {
  for (const value of ["javascript:alert(1)", "data:text/html,hello", "https://user:secret@example.com/file", "https://", "https://example.com/a\nb"]) {
    assert.throws(() => appendAttachmentLink("", "Job Card", value), /valid/);
  }
  assert.throws(() => appendAttachmentLink("", "Unknown", url), /document type/);
  assert.throws(() => appendAttachmentLink("a".repeat(10000), "Job Card", url), /10,000/);
  assert.deepEqual(remarkSegments("<script>alert(1)</script> javascript:alert(1)"), [[{ text: "<script>alert(1)</script> javascript:alert(1)" }]]);
  assert.equal(remarkSegments("https://user:secret@example.com/file")[0][0].url, undefined);
});

test("attachment titles and links stay paired for same-line and email line-break formats", () => {
  assert.deepEqual(attachmentLinkRows(`Job Card: ${url}\nPhoto Of Current Mileage:\n\n${url}\nWarranty Card\n${url}`), [
    { title: "Job Card", url }, { title: "Photo Of Current Mileage", url }, { title: "Warranty Card", url },
  ]);
  assert.deepEqual(attachmentLinkRows("https://example.com/one https://example.com/two"), [
    { title: "Attachment", url: "https://example.com/one" }, { title: "Attachment", url: "https://example.com/two" },
  ]);
  assert.deepEqual(attachmentLinkRows("No file provided\nJob Card:\njavascript:alert(1)"), []);
});

test("attachment preview omits empty fields and keeps the correct title for available files", () => {
  assert.deepEqual(attachmentLinkRows(`Invoice / Cash Bill Of Previous Battery Replacement:\nJob Card: ${url}\nWarranty Card:\nPhoto Of Current Mileage:\n\n${url}\nPhoto Of Car (With Plate Number):`), [
    { title: "Job Card", url }, { title: "Photo Of Current Mileage", url },
  ]);
  assert.deepEqual(attachmentLinkRows("Job Card:\nWarranty Card:\n\n"), []);
  assert.deepEqual(attachmentLinkRows(`Job Card:\nNo file provided\n${url}`), [{ title: "Attachment", url }]);
});
