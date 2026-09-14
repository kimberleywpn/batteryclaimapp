const apiBase = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export async function api(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json', 'X-CellTrack-Request': '1', ...options.headers } : options.headers
  });
  const result = await response.json().catch(() => ({ error: 'The backend returned an invalid response.' }));
  if (!response.ok) throw Object.assign(new Error(result.error || 'Request failed.'), { status: response.status });
  return result;
}
