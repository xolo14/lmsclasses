import { Storage } from "@google-cloud/storage";

const DEFAULT_BUCKET = "lmsclasses-videos";

let storageClient: Storage | null = null;

function getBucketName(): string {
  return process.env.GCS_BUCKET_NAME?.trim() || DEFAULT_BUCKET;
}

function getStorage(): Storage {
  if (storageClient) return storageClient;

  const projectId = process.env.GCP_PROJECT_ID?.trim();
  const clientEmail = process.env.GCP_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "GCS is not configured. Set GCP_PROJECT_ID, GCP_CLIENT_EMAIL, and GCP_PRIVATE_KEY."
    );
  }

  storageClient = new Storage({
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
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

export async function getSignedReadUrl(
  videoKeyOrUrl: string,
  expiresMs = 15 * 60 * 1000
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
  expiresMs = 15 * 60 * 1000
): Promise<string> {
  const trimmed = storedUrl.trim();
  if (!trimmed || !isGcsVideoReference(trimmed)) return trimmed;
  return getSignedReadUrl(trimmed, expiresMs);
}

/** Default TTL for partner API batch responses (players may not start immediately). */
export const PARTNER_SIGNED_URL_TTL_MS = 60 * 60 * 1000;
