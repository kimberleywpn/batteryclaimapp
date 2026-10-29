const apiBase = String(import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");
const tokenKey = "celltrack_access_token";

function storedToken() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem(tokenKey) || "";
}

export function setAuthToken(token) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(tokenKey, token);
  else window.localStorage.removeItem(tokenKey);
}

export async function api(path, options = {}) {
  const {
    timeoutMs = ["/api/session", "/api/login"].includes(path) ? 15000 : undefined,
    signal: requestSignal,
    ...fetchOptions
  } = options;
  const token = storedToken();
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  if (requestSignal?.aborted) onAbort();
  else requestSignal?.addEventListener("abort", onAbort, { once: true });
  const timer = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs)
    : null;

  try {
    const response = await fetch(`${apiBase}${path}`, {
      credentials: 'include',
      cache: 'no-store',
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        ...(fetchOptions.body ? { 'Content-Type': 'application/json', 'X-CellTrack-Request': '1' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...fetchOptions.headers,
      },
    });
    const result = await response.json().catch((error) => {
      if (controller.signal.aborted) throw error;
      throw Object.assign(new Error('The backend returned an invalid response.'), { status: response.status });
    });
    if (path === "/api/session" && (!result || typeof result !== "object" || !Object.hasOwn(result, "user"))) {
      throw new Error('The backend returned an invalid session response.');
    }
    if (response.status === 401 && path !== "/api/login") setAuthToken("");
    if (!response.ok) throw Object.assign(new Error(result.error || 'Request failed.'), { status: response.status });
    return result;
  } catch (error) {
    if (timedOut && !requestSignal?.aborted) {
      throw new Error("The server took too long to respond. Check the backend connection and try again.");
    }
    throw error;
  } finally {
    if (timer !== null) clearTimeout(timer);
    requestSignal?.removeEventListener("abort", onAbort);
  }
}
