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
  const compact = body.replace(/\s+/g, "");
  const lines: string[] = [];
  for (let i = 0; i < compact.length; i += 64) {
    lines.push(compact.slice(i, i + 64));
  }
  return lines.join("\n");
}

/**
 * Hostinger / .env often wrap the PEM in quotes or keep literal `\n`.
 * Normalize to a usable PKCS8 / RSA PEM string OpenSSL accepts.
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

  // Extract existing PEM block if present (tolerant of spacing)
  const pemMatch = key.match(
    /-----BEGIN ([A-Z0-9 ]*PRIVATE KEY)-----([\s\S]*?)-----END \1-----/i
  );
  if (pemMatch) {
    const label = pemMatch[1]!.toUpperCase().replace(/\s+/g, " ").trim();
    const body = chunkBase64(pemMatch[2]!);
    return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
  }

  // Body-only paste (common mistake): wrap as PKCS8
  const maybeBody = key.replace(/\s+/g, "");
  if (
    maybeBody.length > 80 &&
    /^[A-Za-z0-9+/=]+$/.test(maybeBody) &&
    !maybeBody.includes("BEGIN")
  ) {
    const body = chunkBase64(maybeBody);
    return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
  }

  if (!/BEGIN\s+[A-Z0-9 ]*PRIVATE KEY/i.test(key)) {
    return null;
  }

  return key.endsWith("\n") ? key : `${key}\n`;
}

type GcpCredentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  source: "json" | "fields";
};

/**
 * Prefer GCP_SERVICE_ACCOUNT_JSON (entire JSON key file as one line) on Hostinger.
 * Falls back to GCP_PROJECT_ID + GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY.
 */
export function resolveGcpCredentials(): GcpCredentials | null {
  const jsonRaw = process.env.GCP_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(stripWrappingQuotes(unescapeNewlines(jsonRaw))) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      const privateKey = normalizeGcpPrivateKey(parsed.private_key);
      const projectId = (parsed.project_id || process.env.GCP_PROJECT_ID || "").trim();
      const clientEmail = (parsed.client_email || process.env.GCP_CLIENT_EMAIL || "").trim();
      if (projectId && clientEmail && privateKey) {
        return { projectId, clientEmail, privateKey, source: "json" };
      }
    } catch {
      // fall through to field-based config
    }
  }

  const projectId = process.env.GCP_PROJECT_ID?.trim() || "";
  const clientEmail = process.env.GCP_CLIENT_EMAIL?.trim() || "";
  const privateKey = normalizeGcpPrivateKey(process.env.GCP_PRIVATE_KEY);
  if (
    projectId &&
    !projectId.includes("your-gcp") &&
    clientEmail.includes("@") &&
    privateKey
  ) {
    return { projectId, clientEmail, privateKey, source: "fields" };
  }
  return null;
}

export function getGcsEnvStatus() {
  const projectId = process.env.GCP_PROJECT_ID?.trim() || "";
  const clientEmail = process.env.GCP_CLIENT_EMAIL?.trim() || "";
  const privateKeyRaw = process.env.GCP_PRIVATE_KEY?.trim() || "";
  const jsonRaw = process.env.GCP_SERVICE_ACCOUNT_JSON?.trim() || "";
  const creds = resolveGcpCredentials();
  const privateKey = normalizeGcpPrivateKey(process.env.GCP_PRIVATE_KEY);
  const bucket = getBucketName();

  return {
    projectIdSet: !!projectId && !projectId.includes("your-gcp"),
    clientEmailSet:
      !!clientEmail && clientEmail.includes("@") && !clientEmail.includes("your-project"),
    privateKeySet: privateKeyRaw.length > 0,
    privateKeyLooksValid: !!privateKey || !!creds?.privateKey,
    privateKeyLength: privateKeyRaw.length,
    serviceAccountJsonSet: jsonRaw.length > 0,
    credentialSource: creds?.source ?? null,
    bucketName: bucket,
    configured: !!creds,
  };
}

function getStorage(): Storage {
  if (storageClient) return storageClient;

  const creds = resolveGcpCredentials();
  if (!creds) {
    const status = getGcsEnvStatus();
    throw new Error(
      `GCS is not configured correctly (project=${status.projectIdSet}, email=${status.clientEmailSet}, keyValid=${status.privateKeyLooksValid}, json=${status.serviceAccountJsonSet}, keyLen=${status.privateKeyLength}). ` +
        "Prefer GCP_SERVICE_ACCOUNT_JSON (full key file, one line). Then Restart the Node app."
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
