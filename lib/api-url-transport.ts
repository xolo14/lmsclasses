/**
 * Encode/decode values in API JSON so Hostinger/WAF rules that scan POST bodies
 * for http(s) URLs, `if/else`, `python`, etc. do not return empty 403 Forbidden.
 */

const B64_PREFIX = "b64:";

export function encodeUrlForApiTransport(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (typeof window === "undefined") {
    return `${B64_PREFIX}${Buffer.from(trimmed, "utf8").toString("base64url")}`;
  }
  const bytes = new TextEncoder().encode(trimmed);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const b64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${B64_PREFIX}${b64}`;
}

export function decodeUrlFromApiTransport(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith(B64_PREFIX)) return trimmed;
  const payload = trimmed.slice(B64_PREFIX.length);
  if (typeof window === "undefined") {
    return Buffer.from(payload, "base64url").toString("utf8");
  }
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Zod preprocess: accept plain URL or b64:-wrapped transport value. */
export function videoUrlFromApiInput(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return decodeUrlFromApiTransport(value);
  } catch {
    return value;
  }
}

const WRAPPED_KEY = "p";

/** Opaque JSON wrapper so WAF never sees week names, URLs, or code-like text. */
export function wrapApiJson(data: unknown): { p: string } {
  return { p: encodeUrlForApiTransport(JSON.stringify(data)) };
}

/** Unwrap `{ p: "b64:..." }` bodies; pass through already-plain JSON. */
export function unwrapApiJson(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const rec = body as Record<string, unknown>;
  if (typeof rec[WRAPPED_KEY] !== "string") return body;
  try {
    const decoded = decodeUrlFromApiTransport(rec[WRAPPED_KEY]);
    return JSON.parse(decoded) as unknown;
  } catch {
    return body;
  }
}

export async function readApiJson(request: Request): Promise<unknown> {
  const raw = await request.json().catch(() => null);
  return unwrapApiJson(raw);
}
