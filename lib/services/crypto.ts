import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { cleanEnvValue } from "@/lib/env-value";

/**
 * AES-256-GCM for Google OAuth tokens at rest.
 * Payload format: base64( iv[12] | authTag[16] | ciphertext ).
 * Key: GOOGLE_TOKEN_ENCRYPTION_KEY — 32 bytes, base64 (standard or url-safe).
 */

const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;

function decodeKey(raw: string): Buffer {
  const trimmed = raw.trim();
  // Accept base64url as well as standard base64.
  const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const buf = Buffer.from(padded, "base64");
  if (buf.length === KEY_BYTES) return buf;
  // Also allow a 64-char hex key.
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  throw new Error(
    `GOOGLE_TOKEN_ENCRYPTION_KEY must decode to exactly ${KEY_BYTES} bytes (got ${buf.length}). Generate with: openssl rand -base64 32`
  );
}

/** Validates once and caches. Fails fast with a clear message if the key is missing/short. */
export function getTokenEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = cleanEnvValue(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY);
  if (!raw) {
    throw new Error(
      "GOOGLE_TOKEN_ENCRYPTION_KEY is not set. Google Calendar features are disabled until it is configured."
    );
  }
  cachedKey = decodeKey(raw);
  return cachedKey;
}

export function isTokenEncryptionConfigured(): boolean {
  try {
    getTokenEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function encrypt(plain: string): string {
  const key = getTokenEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decrypt(payload: string): string {
  const key = getTokenEncryptionKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new Error("Encrypted payload is too short.");
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
