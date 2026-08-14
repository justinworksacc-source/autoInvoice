const csrfStorageKey = "vss-csrf-token";
export const sessionExpiredEvent = "vss:session-expired";
export function saveCsrfToken(token?: string) {
  try {
    if (token) window.sessionStorage.setItem(csrfStorageKey, token);
    else window.sessionStorage.removeItem(csrfStorageKey);
  } catch {
  }
}
function requestPath(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.pathname;
  return input.url;
}

async function refreshSecurityToken() {
  const response = await fetch("/api/auth", { credentials: "include", cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success || !result.csrf_token) return false;
  saveCsrfToken(result.csrf_token);
  return true;
}

export async function secureFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (mutating) {
    try {
      const csrfToken = window.sessionStorage.getItem(csrfStorageKey);
      if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
    } catch {
    }
  }
  let response = await fetch(input, { ...init, headers, credentials: "include", cache: init.cache || "no-store" });
  const isAuthRequest = requestPath(input).split("?")[0] === "/api/auth";
  if (response.status === 403 && mutating && !isAuthRequest) {
    const error = await response.clone().json().catch(() => ({}));
    if (/security token/i.test(String(error.error || "")) && await refreshSecurityToken()) {
      try {
        const refreshedToken = window.sessionStorage.getItem(csrfStorageKey);
        if (refreshedToken) headers.set("X-CSRF-Token", refreshedToken);
      } catch {
      }
      response = await fetch(input, { ...init, headers, credentials: "include", cache: init.cache || "no-store" });
    }
  }
  if (response.status === 401 && !isAuthRequest) {
    saveCsrfToken(undefined);
    window.dispatchEvent(new CustomEvent(sessionExpiredEvent));
  }
  return response;
}
