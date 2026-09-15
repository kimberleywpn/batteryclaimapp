const apiBase = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
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
  const token = storedToken();
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json', 'X-CellTrack-Request': '1' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({ error: 'The backend returned an invalid response.' }));
  if (response.status === 401 && path !== "/api/login") setAuthToken("");
  if (!response.ok) throw Object.assign(new Error(result.error || 'Request failed.'), { status: response.status });
  return result;
}
