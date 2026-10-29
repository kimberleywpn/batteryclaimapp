import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../api.js";

test("returns a valid signed-out session", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ user: null }));
  assert.deepEqual(await api("/api/session"), { user: null });
});

test("times out when the backend does not respond", async (t) => {
  t.mock.method(globalThis, "fetch", (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  await assert.rejects(api("/api/login", { timeoutMs: 10 }), /took too long/);
});

test("times out when response headers arrive but the body stalls", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, { signal }) => ({
    ok: true,
    status: 200,
    json: () => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }),
  }));
  await assert.rejects(api("/api/session", { timeoutMs: 10 }), /took too long/);
});

test("rejects HTML or missing session data instead of continuing startup", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => new Response("<html>Unavailable</html>"));
  await assert.rejects(api("/api/session"), /invalid response/);
  mock.mock.mockImplementation(async () => Response.json({ error: "Unavailable" }));
  await assert.rejects(api("/api/session"), /invalid session response/);
});

test("preserves caller cancellation even when already aborted", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, { signal }) => {
    signal.throwIfAborted();
    return Response.json({});
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(api("/api/serial-lookup", { signal: controller.signal }), { name: "AbortError" });
});
