/** Typed errors so callers can branch without string-matching Google's responses. */

export class GoogleNotConnectedError extends Error {
  readonly userId: string;
  constructor(userId: string) {
    super("This user has not connected a Google account.");
    this.name = "GoogleNotConnectedError";
    this.userId = userId;
  }
}

export class GoogleReconnectRequiredError extends Error {
  readonly userId: string;
  constructor(userId: string, reason?: string) {
    super(reason || "Google access was revoked or expired. Reconnect the Google account.");
    this.name = "GoogleReconnectRequiredError";
    this.userId = userId;
  }
}

export class GoogleQuotaError extends Error {
  readonly retryAfterSec: number | null;
  constructor(message: string, retryAfterSec: number | null = null) {
    super(message);
    this.name = "GoogleQuotaError";
    this.retryAfterSec = retryAfterSec;
  }
}

export class GoogleEventNotFoundError extends Error {
  readonly eventId: string;
  constructor(eventId: string) {
    super(`Google Calendar event ${eventId} was not found.`);
    this.name = "GoogleEventNotFoundError";
    this.eventId = eventId;
  }
}

export class GoogleConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleConfigError";
  }
}

type GaxiosLike = {
  code?: number | string;
  status?: number;
  message?: string;
  response?: {
    status?: number;
    headers?: Record<string, unknown> | { get?: (k: string) => string | null };
    data?: unknown;
  };
  errors?: Array<{ reason?: string; message?: string; domain?: string }>;
};

/** HTTP status from a googleapis / gaxios error, if any. */
export function googleErrorStatus(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const e = err as GaxiosLike;
  if (typeof e.response?.status === "number") return e.response.status;
  if (typeof e.status === "number") return e.status;
  if (typeof e.code === "number") return e.code;
  if (typeof e.code === "string" && /^\d{3}$/.test(e.code)) return Number(e.code);
  return null;
}

/** Reasons like rateLimitExceeded, userRateLimitExceeded, insufficientPermissions, notFound. */
export function googleErrorReasons(err: unknown): string[] {
  if (!err || typeof err !== "object") return [];
  const e = err as GaxiosLike;
  const out: string[] = [];
  for (const item of e.errors ?? []) if (item?.reason) out.push(item.reason);
  const data = e.response?.data as
    | { error?: string | { errors?: Array<{ reason?: string }>; status?: string; message?: string } }
    | undefined;
  if (data && typeof data.error === "string") out.push(data.error);
  if (data && typeof data.error === "object") {
    for (const item of data.error.errors ?? []) if (item?.reason) out.push(item.reason);
    if (data.error.status) out.push(data.error.status);
  }
  return out;
}

export function googleRetryAfterSeconds(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const headers = (err as GaxiosLike).response?.headers;
  if (!headers) return null;
  let value: unknown = null;
  if (typeof (headers as { get?: unknown }).get === "function") {
    value = (headers as { get: (k: string) => string | null }).get("retry-after");
  } else {
    const rec = headers as Record<string, unknown>;
    value = rec["retry-after"] ?? rec["Retry-After"];
  }
  if (value == null) return null;
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : null;
}

export function isInvalidGrant(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as GaxiosLike;
  const data = e.response?.data as { error?: unknown } | undefined;
  const msg = `${e.message ?? ""} ${typeof data?.error === "string" ? data.error : ""}`;
  return /invalid_grant/i.test(msg);
}

export function isInsufficientScope(err: unknown): boolean {
  const reasons = googleErrorReasons(err);
  if (reasons.some((r) => /insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT|PERMISSION_DENIED/i.test(r))) {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /insufficient.*scope|insufficientPermissions/i.test(msg);
}

export function isRateLimited(err: unknown): boolean {
  const status = googleErrorStatus(err);
  if (status === 429) return true;
  if (status === 403) {
    return googleErrorReasons(err).some((r) =>
      /rateLimitExceeded|userRateLimitExceeded|quotaExceeded|RESOURCE_EXHAUSTED/i.test(r)
    );
  }
  return false;
}

export function isTransientNetworkError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ECONNREFUSED|EPIPE/.test(code)) {
    return true;
  }
  const msg = (err as { message?: unknown }).message;
  return typeof msg === "string" && /socket hang up|network timeout|fetch failed/i.test(msg);
}

/**
 * googleapis errors carry the full request config (headers incl. Authorization).
 * Never log the raw object — reduce it to status, reasons, message.
 */
export function scrubGoogleError(err: unknown): { name: string; status: number | null; reasons: string[]; message: string } {
  const status = googleErrorStatus(err);
  const reasons = googleErrorReasons(err);
  let message = err instanceof Error ? err.message : String(err ?? "Unknown error");
  // Strip anything that looks like a bearer token or client secret.
  message = message.replace(/ya29\.[A-Za-z0-9\-_]+/g, "[token]").replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, "Bearer [token]");
  if (message.length > 400) message = `${message.slice(0, 400)}…`;
  return { name: err instanceof Error ? err.name : "Error", status, reasons, message };
}

/** Short, user-safe string for meet_error / last_error columns. */
export function describeGoogleError(err: unknown): string {
  if (err instanceof GoogleNotConnectedError) return "Host has not connected Google.";
  if (err instanceof GoogleReconnectRequiredError) return "Host must reconnect Google.";
  if (err instanceof GoogleQuotaError) return "Google API quota exceeded. Will retry.";
  if (err instanceof GoogleEventNotFoundError) return "Google event no longer exists.";
  if (err instanceof GoogleConfigError) return err.message;
  const s = scrubGoogleError(err);
  const reason = s.reasons[0] ? ` (${s.reasons[0]})` : "";
  return `${s.status ? `HTTP ${s.status} ` : ""}${s.message}${reason}`.slice(0, 500);
}
