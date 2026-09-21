/**
 * Browser-only helpers for uploading recorded-class videos straight to GCS via a
 * server-created resumable session. Bytes never touch our Node process, so the
 * only size cap is MAX_VIDEO_UPLOAD_BYTES (5 GB) — not the Next.js body limit.
 */
import { VIDEO_UPLOAD_CHUNK_BYTES, getVideoSizeError } from "@/lib/video-upload";

export type ResumableSession = {
  uploadUrl: string;
  objectKey: string;
  folderName: string;
  safeFilename: string;
  chunkBytes: number;
  maxBytes: number;
};

export class VideoUploadError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "VideoUploadError";
    this.status = status;
  }
}

/** GCS returns JSON (`{"error":{"message"}}`) on the JSON API and XML (`<Message>`) on the XML API. */
export function parseGcsErrorBody(body: string | null | undefined): string | null {
  const text = body?.trim();
  if (!text) return null;
  try {
    const json = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    if (typeof json.error === "string") return json.error;
    if (json.error?.message) return json.error.message;
    if (json.message) return json.message;
  } catch {
    /* not JSON */
  }
  const xml = text.match(/<Message>([\s\S]*?)<\/Message>/i)?.[1]?.trim();
  if (xml) return xml;
  const details = text.match(/<Details>([\s\S]*?)<\/Details>/i)?.[1]?.trim();
  if (details) return details;
  return text.length <= 300 ? text : null;
}

/** Ask the server to open a GCS resumable session for this file. Fails fast on size. */
export async function startResumableVideoUpload(args: {
  file: File;
  batchId?: string;
  liveClassId?: string;
}): Promise<ResumableSession> {
  const { batchId, liveClassId, file } = args;

  if (!batchId && !liveClassId) {
    throw new VideoUploadError("A batch or live class is required to start the upload.");
  }

  const sizeError = getVideoSizeError(file.size);
  if (sizeError) throw new VideoUploadError(sizeError, 413);

  const res = await fetch("/api/uploads/video-resumable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(liveClassId ? { liveClassId } : { batchId }),
      filename: file.name,
      contentType: file.type || "video/webm",
      fileSize: file.size,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<ResumableSession> & {
    error?: string;
  };

  if (!res.ok || !data.uploadUrl || !data.objectKey) {
    throw new VideoUploadError(
      data.error || `Failed to start the storage upload session (HTTP ${res.status}).`,
      res.status
    );
  }

  return {
    uploadUrl: data.uploadUrl,
    objectKey: data.objectKey,
    folderName: data.folderName ?? "",
    safeFilename: data.safeFilename ?? file.name,
    chunkBytes: data.chunkBytes && data.chunkBytes > 0 ? data.chunkBytes : VIDEO_UPLOAD_CHUNK_BYTES,
    maxBytes: data.maxBytes ?? 0,
  };
}

type PutResult = { status: number; rangeEnd: number | null; body: string };

function putChunk(
  uploadUrl: string,
  blob: Blob | null,
  contentRange: string,
  onChunkProgress?: (loaded: number) => void
): Promise<PutResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Range", contentRange);

    if (onChunkProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onChunkProgress(e.loaded);
      };
    }

    xhr.onload = () => {
      // GCS answers `308 Resume Incomplete` for accepted intermediate chunks and
      // reports how much it has persisted via `Range: bytes=0-N`.
      // Do not call getResponseHeader("Range") — Chromium logs "unsafe header"
      // when CORS does not expose it, and returns null anyway.
      let rangeEnd: number | null = null;
      try {
        const m = (xhr.getAllResponseHeaders() || "").match(
          /(?:^|\r?\n)range:\s*bytes=0-(\d+)/i
        );
        if (m) rangeEnd = Number(m[1]);
      } catch {
        /* CORS may hide Range */
      }
      resolve({
        status: xhr.status,
        rangeEnd,
        body: xhr.responseText ?? "",
      });
    };
    xhr.onerror = () => reject(new VideoUploadError("Network error while uploading to storage."));
    xhr.onabort = () => reject(new VideoUploadError("Upload was cancelled."));
    xhr.ontimeout = () => reject(new VideoUploadError("Upload chunk timed out."));

    xhr.send(blob ?? new Blob());
  });
}

/** Query how many bytes GCS has persisted so an interrupted upload can resume. */
async function queryPersistedOffset(uploadUrl: string, total: number): Promise<number | "done" | null> {
  const r = await putChunk(uploadUrl, null, `bytes */${total}`);
  if (r.status === 200 || r.status === 201) return "done";
  if (r.status === 308) return r.rangeEnd === null ? 0 : r.rangeEnd + 1;
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Upload the file to the resumable session in fixed-size chunks with retry.
 * `onProgress` receives bytes uploaded so far (0..file.size).
 */
export async function uploadFileToResumableSession(
  file: File,
  session: ResumableSession,
  opts: { onProgress?: (uploadedBytes: number) => void; maxAttemptsPerChunk?: number } = {}
): Promise<void> {
  const { onProgress, maxAttemptsPerChunk = 6 } = opts;
  const total = file.size;
  const chunkBytes = session.chunkBytes;
  let offset = 0;
  let attempt = 0;

  while (offset < total) {
    const end = Math.min(offset + chunkBytes, total);
    const blob = file.slice(offset, end);
    const contentRange = `bytes ${offset}-${end - 1}/${total}`;

    try {
      const result = await putChunk(session.uploadUrl, blob, contentRange, (loaded) =>
        onProgress?.(Math.min(offset + loaded, total))
      );

      if (result.status === 200 || result.status === 201) {
        onProgress?.(total);
        return;
      }

      if (result.status === 308) {
        // Trust GCS's persisted range when it exposes it; otherwise assume the chunk landed.
        offset = result.rangeEnd !== null ? result.rangeEnd + 1 : end;
        onProgress?.(offset);
        attempt = 0;
        continue;
      }

      const gcsMessage = parseGcsErrorBody(result.body);
      const retryable = result.status === 429 || result.status >= 500 || result.status === 400;
      if (!retryable || attempt >= maxAttemptsPerChunk - 1) {
        throw new VideoUploadError(
          gcsMessage
            ? `Storage rejected the upload (HTTP ${result.status}): ${gcsMessage}`
            : `Storage rejected the upload with HTTP ${result.status}.`,
          result.status
        );
      }
    } catch (err) {
      const isNetwork = err instanceof VideoUploadError && err.status === null;
      const isAbort = err instanceof VideoUploadError && err.message === "Upload was cancelled.";
      if (isAbort || !isNetwork || attempt >= maxAttemptsPerChunk - 1) {
        if (err instanceof VideoUploadError) throw err;
        throw new VideoUploadError(err instanceof Error ? err.message : "Upload failed.");
      }
    }

    // Retry path: back off, then ask GCS where to resume from.
    attempt += 1;
    await sleep(Math.min(1000 * 2 ** attempt, 15000));
    try {
      const persisted = await queryPersistedOffset(session.uploadUrl, total);
      if (persisted === "done") {
        onProgress?.(total);
        return;
      }
      if (typeof persisted === "number") offset = persisted;
    } catch {
      /* status probe failed — retry the same chunk */
    }
  }
}
