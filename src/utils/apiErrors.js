const TOKEN_KEY = "leo_token";

let authRedirectInProgress = false;

export class ApiError extends Error {
  constructor({
    status,
    code,
    message,
    traceId = null,
    retryable = false,
    details = null,
    method = "GET",
    url = "",
  }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.traceId = traceId;
    this.retryable = retryable;
    this.details = details;
    this.method = method;
    this.url = url;
  }
}

function detailToMessage(detail, fallback) {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d) => d?.msg || d?.message || JSON.stringify(d))
      .filter(Boolean)
      .join("; ");
  }
  if (detail && typeof detail === "object") {
    return detail.message || detail.msg || fallback;
  }
  return fallback;
}

function inferCode(status, message) {
  const msg = String(message || "").toLowerCase();
  if (status === 401) {
    if (msg.includes("expired")) return "TOKEN_EXPIRED";
    if (msg.includes("invalid")) return "TOKEN_INVALID";
    if (msg.includes("not authenticated") || msg.includes("unauthorized")) return "TOKEN_MISSING";
    if (msg.includes("email or password") || msg.includes("account disabled")) return "INVALID_CREDENTIALS";
    return "UNAUTHORIZED";
  }
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422 || status === 400) return "VALIDATION_FAILED";
  if (status >= 500) return "INTERNAL_ERROR";
  return "UNKNOWN_ERROR";
}

export async function parseApiErrorResponse(res, method, url) {
  const text = await res.text().catch(() => "");
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  const envelope = payload?.error ?? null;
  const detail = payload?.detail;
  const status = res.status;
  const traceId = envelope?.traceId || payload?.traceId || res.headers.get("x-request-id") || null;
  const message = detailToMessage(
    envelope?.message ?? detail,
    `API ${method} ${url} failed with ${status}`
  );
  const code = envelope?.code || payload?.code || inferCode(status, message);
  const retryable = typeof envelope?.retryable === "boolean" ? envelope.retryable : status >= 500;

  return new ApiError({
    status,
    code,
    message,
    traceId,
    retryable,
    details: payload,
    method,
    url,
  });
}

function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function maybeTriggerAuthRedirect(error) {
  if (!(error instanceof ApiError)) return;
  if (error.status !== 401) return;
  if (!["TOKEN_EXPIRED", "TOKEN_INVALID", "TOKEN_MISSING", "UNAUTHORIZED"].includes(error.code)) return;
  if (authRedirectInProgress) return;

  authRedirectInProgress = true;
  clearToken();
  window.dispatchEvent(new CustomEvent("leo:auth-expired", { detail: error }));
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}
