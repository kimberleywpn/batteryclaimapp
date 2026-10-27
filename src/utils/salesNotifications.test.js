import test from "node:test";
import assert from "node:assert/strict";
import { pendingBySalesperson, salespersonMessage, whatsappUrl } from "./salesNotifications.js";

test("summaries combine each salesperson's pending cases and exclude other stages", () => {
  const claims = [
    { salesperson: " GKS ", status: "sales", approval: { decision: "pending" } },
    { salesperson: "gks", status: "sales" },
    { salesperson: "Daniel", status: "sales", approval: { decision: "pending" } },
    { salesperson: "GKS", status: "sales", approval: { decision: "approved" } },
    { salesperson: "GKS", status: "admin" },
    { salesperson: "GKS", status: "complete" },
    { salesperson: "GKS", status: "cancelled" },
  ];
  assert.deepEqual(pendingBySalesperson(claims), [
    { key: "daniel", name: "Daniel", count: 1 },
    { key: "gks", name: "GKS", count: 2 },
  ]);
  assert.deepEqual(pendingBySalesperson([]), []);
});

test("summary links retain the deployment path without carrying old search parameters", () => {
  const text = salespersonMessage({ name: "GKS", count: 2 }, "https://example.com/batteryclaimapp/?other=secret#old");
  assert.equal(text, "Hi GKS, you have 2 battery claims awaiting your review in CellTrack.\nPlease review them here:\nhttps://example.com/batteryclaimapp/?page=sales&view=pending");
  assert.match(salespersonMessage({ name: "Daniel", count: 1 }, "https://example.com/"), /1 battery claim awaiting/);
});

test("WhatsApp uses international numbers or lets the admin choose a contact", () => {
  const text = "Please review\nhttps://example.com/?page=sales&view=pending";
  const url = new URL(whatsappUrl("+60 (12) 345-6789", text));
  assert.equal(url.pathname, "/60123456789");
  assert.equal(url.searchParams.get("text"), text);
  assert.equal(new URL(whatsappUrl("", text)).pathname, "/");
  assert.throws(() => whatsappUrl("0123456789", text), /international number/);
  assert.throws(() => whatsappUrl("601234<script>", text), /international number/);
});

