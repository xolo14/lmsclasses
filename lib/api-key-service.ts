import { createHash, randomBytes } from "crypto";
import {
  API_KEY_PREFIX_LIVE,
  API_KEY_PREFIX_TEST,
  type ApiKeyEnvironment,
} from "@/lib/api-key-types";

export {
  API_PERMISSIONS,
  PERMISSION_GROUPS,
  DEFAULT_LEAD_FIELDS,
  DEFAULT_RATE_LIMIT,
} from "@/lib/api-key-types";
export type { ApiPermission } from "@/lib/api-key-types";

export function getKeyPrefix(environment: ApiKeyEnvironment): string {
  return environment === "test" ? API_KEY_PREFIX_TEST : API_KEY_PREFIX_LIVE;
}

export function generatePlainApiKey(environment: ApiKeyEnvironment = "live"): string {
  const prefix = getKeyPrefix(environment);
  return `${prefix}${randomBytes(32).toString("hex")}`;
}

export function hashApiKey(plainKey: string): string {
  return createHash("sha256").update(plainKey).digest("hex");
}

/** First 8 hex chars after prefix — shown in admin UI */
export function extractDisplayPrefix(plainKey: string): string {
  if (plainKey.startsWith(API_KEY_PREFIX_LIVE)) {
    return plainKey.slice(API_KEY_PREFIX_LIVE.length, API_KEY_PREFIX_LIVE.length + 8);
  }
  if (plainKey.startsWith(API_KEY_PREFIX_TEST)) {
    return plainKey.slice(API_KEY_PREFIX_TEST.length, API_KEY_PREFIX_TEST.length + 8);
  }
  return plainKey.slice(-8);
}

export function maskFromPrefix(keyPrefix: string, environment = "live"): string {
  const base = environment === "test" ? API_KEY_PREFIX_TEST : API_KEY_PREFIX_LIVE;
  return `${base}${keyPrefix}…`;
}

export function isValidApiKeyFormat(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX_LIVE) || token.startsWith(API_KEY_PREFIX_TEST);
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export function sanitizeLogBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const copy = { ...(body as Record<string, unknown>) };
  for (const key of Object.keys(copy)) {
    if (/password|secret|key|token|signature/i.test(key)) {
      copy[key] = "[REDACTED]";
    }
  }
  return copy;
}

export function isTestKey(apiKey: { environment?: string | null }): boolean {
  return apiKey.environment === "test";
}

export function courseAllowed(apiKey: { allowedCourses?: string[] | null }, courseName: string): boolean {
  const allowed = (apiKey.allowedCourses ?? []) as string[];
  if (allowed.length === 0) return true;
  const normalized = courseName.trim().toLowerCase();
  return allowed.some((c) => c.trim().toLowerCase() === normalized);
}
