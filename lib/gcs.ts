import { createPrivateKey } from "crypto";
import { Storage } from "@google-cloud/storage";

const DEFAULT_BUCKET = "lmsclasses-videos";

let storageClient: Storage | null = null;

function getBucketName(): string {
  return process.env.GCS_BUCKET_NAME?.trim() || DEFAULT_BUCKET;
}

function stripWrappingQuotes(value: string): string {
  let key = value.trim();
  for (let i = 0; i < 3; i++) {
    if (
      (key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))
    ) {
      key = key.slice(1, -1).trim();
    } else {
      break;
    }
  }
  return key;
}

function unescapeNewlines(value: string): string {
  let key = value;
  // Hostinger / JSON may double-escape: \\n → \n → real newline
  for (let i = 0; i < 3; i++) {
    if (!key.includes("\\n")) break;
    key = key.replace(/\\n/g, "\n");
  }
  return key.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Fix smart quotes / unicode dashes that break OpenSSL PEM parsing. */
function sanitizePemAscii(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"');
}

function chunkBase64(body: string): string {
  let compact = body
    .replace(/\\n/g, "")
    // Hostinger/forms often turn base64 `+` into spaces — restore before stripping WS
    .replace(/ /g, "+")
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9+/=]/g, "");

  // Fix padding
  const pad = compact.length % 4;
  if (pad === 1) {
    // truncated — unrecoverable
    return "";
  }
  if (pad > 0) {
    compact += "=".repeat(4 - pad);
  }

  // Verify it actually decodes
  try {
    Buffer.from(compact, "base64");
  } catch {
    return "";
  }

  const lines: string[] = [];
  for (let i = 0; i < compact.length; i += 64) {
    lines.push(compact.slice(i, i + 64));
  }
  return lines.join("\n");
}

/** Pull private_key out of mangled JSON text when JSON.parse fails. */
function extractPrivateKeyFromJsonText(text: string): string | null {
  const m = text.match(/"private_key"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (!m?.[1]) return null;
  try {
    // Re-parse as a JSON string to undo \n \u escapes
    return JSON.parse(`"${m[1]}"`) as string;
  } catch {
    return m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }
}

function extractJsonField(text: string, field: string): string | null {
  const re = new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`);
  const m = text.match(re);
  if (!m?.[1]) return null;
  try {
    return JSON.parse(`"${m[1]}"`) as string;
  } catch {
    return m[1];
  }
}

/** Safe probe of raw env (never returns key material). */
export function probePrivateKeyEnv(raw: string | undefined) {
  const value = raw ?? "";
  const first = value.slice(0, 24);
  return {
    length: value.length,
    hasBegin: /BEGIN\s+[A-Z0-9 ]*PRIVATE KEY/i.test(value),
    hasEnd: /END\s+[A-Z0-9 ]*PRIVATE KEY/i.test(value),
    hasBackslashN: value.includes("\\n"),
    hasRealNewline: value.includes("\n"),
    /** Hex of first bytes — should start with 2d2d2d2d2d424547494e = -----BEGIN */
    headHex: Buffer.from(first, "utf8").toString("hex"),
  };
}

/**
 * Hostinger / .env often wrap the PEM in quotes or keep literal `\n`.
 * Normalize to a usable PKCS8 / RSA PEM string OpenSSL accepts.
 * OpenSSL requires a REAL newline after the BEGIN line — literal \n is not enough.
 */
export function normalizeGcpPrivateKey(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;

  let key = sanitizePemAscii(stripWrappingQuotes(raw));

  // Accidentally pasted the whole service-account JSON into GCP_PRIVATE_KEY
  if (key.startsWith("{") && key.includes("private_key")) {
    try {
      const parsed = JSON.parse(unescapeNewlines(key)) as { private_key?: string };
      if (parsed.private_key) {
        key = sanitizePemAscii(stripWrappingQuotes(parsed.private_key));
      }
    } catch {
      // continue with raw
    }
  }

  key = unescapeNewlines(key).trim();

  // Still no real newlines? Force-split on literal \n or compact markers.
  if (!key.includes("\n")) {
    if (key.includes("\\n")) {
      key = key.split("\\n").join("\n");
    } else {
      key = key
        .replace(/(-+BEGIN [A-Z0-9 ]*PRIVATE KEY-+)/i, "$1\n")
        .replace(/(-+END [A-Z0-9 ]*PRIVATE KEY-+)/i, "\n$1\n");
    }
  }

  // Tolerant extract (4–6 dashes, optional spaces)
  const pemMatch = key.match(
    /-+BEGIN\s+([A-Z0-9 ]*PRIVATE KEY)-+\s*([\s\S]*?)\s*-+END\s+\1-+/i
  );
  if (pemMatch) {
    const label = pemMatch[1]!.toUpperCase().replace(/\s+/g, " ").trim();
    const body = chunkBase64(pemMatch[2]!);
    if (body.length < 80) return null;
    return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
  }

  // Looser: any BEGIN ... END PRIVATE KEY pair
  const loose = key.match(
    /-+BEGIN\s+([A-Z0-9 ]*PRIVATE KEY)-+\s*([\s\S]*?)\s*-+END\s+[A-Z0-9 ]*PRIVATE KEY-+/i
  );
  if (loose) {
    const label = loose[1]!.toUpperCase().replace(/\s+/g, " ").trim();
    const body = chunkBase64(loose[2]!);
    if (body.length < 80) return null;
    return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
  }

  // Body-only paste (common mistake): wrap as PKCS8
  const maybeBody = key.replace(/\s+/g, "").replace(/\\n/g, "");
  if (
    maybeBody.length > 80 &&
    /^[A-Za-z0-9+/=]+$/.test(maybeBody) &&
    !/BEGIN/i.test(maybeBody)
  ) {
    const body = chunkBase64(maybeBody);
    return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
  }

  return null;
}

type GcpCredentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  source: "json" | "json_b64" | "fields" | "key_b64";
};

function decodeBase64Env(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const text = Buffer.from(stripWrappingQuotes(raw).replace(/\s+/g, ""), "base64").toString(
      "utf8"
    );
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}

function assertPrivateKeyUsable(pem: string): void {
  createPrivateKey(pem);
}

/**
 * Prefer base64 env vars on Hostinger (no broken \\n handling).
 * Order: JSON_BASE64 → JSON → PRIVATE_KEY_BASE64 → fields.
 */
export function resolveGcpCredentials(): GcpCredentials | null {
  const tryFromJson = (
    jsonText: string,
    source: GcpCredentials["source"]
  ): GcpCredentials | null => {
    const cleaned = stripWrappingQuotes(jsonText);
    let projectId = "";
    let clientEmail = "";
    let privateKeyRaw: string | undefined;

    try {
      const parsed = JSON.parse(cleaned) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      projectId = (parsed.project_id || "").trim();
      clientEmail = (parsed.client_email || "").trim();
      privateKeyRaw = parsed.private_key;
    } catch {
      // Hostinger may break JSON by inserting real newlines into private_key
      projectId = (extractJsonField(cleaned, "project_id") || "").trim();
      clientEmail = (extractJsonField(cleaned, "client_email") || "").trim();
      privateKeyRaw = extractPrivateKeyFromJsonText(cleaned) || undefined;
    }

    projectId = projectId || process.env.GCP_PROJECT_ID?.trim() || "";
    clientEmail = clientEmail || process.env.GCP_CLIENT_EMAIL?.trim() || "";
    const privateKey = normalizeGcpPrivateKey(privateKeyRaw);
    if (!projectId || !clientEmail.includes("@") || !privateKey) return null;
    try {
      assertPrivateKeyUsable(privateKey);
      return { projectId, clientEmail, privateKey, source };
    } catch {
      return null;
    }
  };

  const jsonB64 = decodeBase64Env(process.env.GCP_SERVICE_ACCOUNT_JSON_BASE64);
  if (jsonB64) {
    const creds = tryFromJson(jsonB64, "json_b64");
    if (creds) return creds;
  }

  const jsonRaw = process.env.GCP_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    const creds = tryFromJson(jsonRaw, "json");
    if (creds) return creds;
  }

  const projectId = process.env.GCP_PROJECT_ID?.trim() || "";
  const clientEmail = process.env.GCP_CLIENT_EMAIL?.trim() || "";

  const keyB64 = decodeBase64Env(process.env.GCP_PRIVATE_KEY_BASE64);
  if (keyB64 && projectId && clientEmail.includes("@")) {
    const privateKey = normalizeGcpPrivateKey(keyB64);
    if (privateKey) {
      try {
        assertPrivateKeyUsable(privateKey);
        return { projectId, clientEmail, privateKey, source: "key_b64" };
      } catch {
        // fall through
      }
    }
  }

  const privateKey = normalizeGcpPrivateKey(process.env.GCP_PRIVATE_KEY);
  if (
    projectId &&
    !projectId.includes("your-gcp") &&
    clientEmail.includes("@") &&
    privateKey
  ) {
    try {
      assertPrivateKeyUsable(privateKey);
      return { projectId, clientEmail, privateKey, source: "fields" };
    } catch {
      return null;
    }
  }
  return null;
}

export function getGcsEnvStatus() {
  const projectId = process.env.GCP_PROJECT_ID?.trim() || "";
  const clientEmail = process.env.GCP_CLIENT_EMAIL?.trim() || "";
  const privateKeyRaw = process.env.GCP_PRIVATE_KEY?.trim() || "";
  const jsonRaw = process.env.GCP_SERVICE_ACCOUNT_JSON?.trim() || "";
  const keyProbe = probePrivateKeyEnv(process.env.GCP_PRIVATE_KEY);
  const creds = resolveGcpCredentials();

  let privateKeyCryptoOk: boolean | null = null;
  let privateKeyCryptoError: string | null = null;
  const normalized = normalizeGcpPrivateKey(process.env.GCP_PRIVATE_KEY);
  if (creds) {
    privateKeyCryptoOk = true;
  } else if (normalized) {
    try {
      assertPrivateKeyUsable(normalized);
      privateKeyCryptoOk = true;
    } catch (err) {
      privateKeyCryptoOk = false;
      privateKeyCryptoError =
        err instanceof Error ? err.message.slice(0, 200) : "crypto_failed";
    }
  } else if (privateKeyRaw) {
    privateKeyCryptoOk = false;
    privateKeyCryptoError = "normalize_failed";
  }

  return {
    projectIdSet: !!projectId && !projectId.includes("your-gcp"),
    clientEmailSet:
      !!clientEmail && clientEmail.includes("@") && !clientEmail.includes("your-project"),
    privateKeySet: privateKeyRaw.length > 0,
    privateKeyLooksValid: !!normalized || !!creds?.privateKey,
    privateKeyLength: privateKeyRaw.length,
    privateKeyProbe: keyProbe,
    privateKeyCryptoOk,
    privateKeyCryptoError,
    serviceAccountJsonSet: jsonRaw.length > 0,
    serviceAccountJsonBase64Set: !!process.env.GCP_SERVICE_ACCOUNT_JSON_BASE64?.trim(),
    privateKeyBase64Set: !!process.env.GCP_PRIVATE_KEY_BASE64?.trim(),
    credentialSource: creds?.source ?? null,
    bucketName: getBucketName(),
    configured: !!creds,
  };
}

function getStorage(): Storage {
  if (storageClient) return storageClient;

  const creds = resolveGcpCredentials();
  if (!creds) {
    const status = getGcsEnvStatus();
    throw new Error(
      `GCS credentials unusable (cryptoOk=${status.privateKeyCryptoOk}, source=${status.credentialSource}, keyLen=${status.privateKeyLength}, err=${status.privateKeyCryptoError ?? "n/a"}). ` +
        "On Hostinger set GCP_SERVICE_ACCOUNT_JSON_BASE64 (base64 of the full .json key file), then Restart Node."
    );
  }

  storageClient = new Storage({
    projectId: creds.projectId,
    credentials: {
      client_email: creds.clientEmail,
      private_key: creds.privateKey,
    },
  });

  return storageClient;
}

/**
 * Extract a GCS object key from a stored videoKey, gs:// URI, or https URL.
 * Returns null when the value is not a GCS object in our configured bucket
 * (or any bucket when the key is a bare path).
 */
export function parseGcsObjectKey(
  videoKeyOrUrl: string,
  bucketName = getBucketName()
): string | null {
  const raw = videoKeyOrUrl.trim();
  if (!raw) return null;

  // Bare object path: lessons/module1-intro.mp4
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.includes("://")) {
    return raw.replace(/^\/+/, "");
  }

  // gs://bucket/object
  const gsMatch = raw.match(/^gs:\/\/([^/]+)\/(.+)$/i);
  if (gsMatch) {
    const [, bucket, objectKey] = gsMatch;
    if (bucket !== bucketName) return null;
    return objectKey;
  }

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();

    // https://storage.googleapis.com/bucket/object
    // https://storage.cloud.google.com/bucket/object
    if (
      host === "storage.googleapis.com" ||
      host === "storage.cloud.google.com"
    ) {
      const parts = url.pathname.replace(/^\/+/, "").split("/");
      const [bucket, ...rest] = parts;
      if (!bucket || rest.length === 0) return null;
      if (bucket !== bucketName) return null;
      return decodeURIComponent(rest.join("/"));
    }

    // https://bucket.storage.googleapis.com/object
    if (host === `${bucketName.toLowerCase()}.storage.googleapis.com`) {
      const key = url.pathname.replace(/^\/+/, "");
      return key ? decodeURIComponent(key) : null;
    }
  } catch {
    return null;
  }

  return null;
}

/** True when the URL/key should be played via a short-lived signed URL. */
export function isGcsVideoReference(videoKeyOrUrl: string): boolean {
  return parseGcsObjectKey(videoKeyOrUrl) !== null;
}

/** Default TTL for logged-in LMS players (long enough for a full lesson). */
export const LMS_SIGNED_URL_TTL_MS = 4 * 60 * 60 * 1000;

/** Default TTL for partner API batch responses (players may not start immediately). */
export const PARTNER_SIGNED_URL_TTL_MS = 60 * 60 * 1000;

export async function getSignedReadUrl(
  videoKeyOrUrl: string,
  expiresMs = LMS_SIGNED_URL_TTL_MS
): Promise<string> {
  const bucketName = getBucketName();
  const objectKey = parseGcsObjectKey(videoKeyOrUrl, bucketName);
  if (!objectKey) {
    throw new Error("Invalid or non-GCS video key");
  }

  const storage = getStorage();
  const file = storage.bucket(bucketName).file(objectKey);
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + expiresMs,
  });

  return signedUrl;
}

/** Partner / player responses: sign private GCS refs; leave YouTube and public URLs as-is. */
export async function toPlayableVideoUrl(
  storedUrl: string,
  expiresMs = LMS_SIGNED_URL_TTL_MS
): Promise<string> {
  const trimmed = storedUrl.trim();
  if (!trimmed || !isGcsVideoReference(trimmed)) return trimmed;
  return getSignedReadUrl(trimmed, expiresMs);
}
