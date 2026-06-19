import { createHash, randomBytes } from "crypto";

export const API_KEY_PREFIX = "lms_live_";

export const API_PERMISSIONS = ["submit_lead", "confirm_payment"] as const;
export type ApiPermission = (typeof API_PERMISSIONS)[number];

export function generatePlainApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(32).toString("hex")}`;
}

export function hashApiKey(plainKey: string): string {
  return createHash("sha256").update(plainKey).digest("hex");
}

export function maskApiKey(plainKey: string): string {
  if (!plainKey.startsWith(API_KEY_PREFIX)) return "lms_live_****";
  const suffix = plainKey.slice(-4);
  return `${API_KEY_PREFIX}****${suffix}`;
}

export function maskFromPrefix(keyPrefix: string): string {
  return `${API_KEY_PREFIX}****${keyPrefix}`;
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}
