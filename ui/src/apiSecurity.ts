const csrfStorageKey = "vss-csrf-token";
export function saveCsrfToken(token?: string) {
  try {
    if (token) window.sessionStorage.setItem(csrfStorageKey, token);
    else window.sessionStorage.removeItem(csrfStorageKey);
  } catch {
  }
}
export function secureFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    try {
      const csrfToken = window.sessionStorage.getItem(csrfStorageKey);
      if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
    } catch {
    }
  }
  return fetch(input, { ...init, headers, credentials: "include" });
}
