import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getAppUrl } from "@/lib/app-url";
import {
  checkVideoBucketPermissions,
  createResumableUploadSession,
  getGcsUploadConfigError,
} from "@/lib/gcs";
import {
  MAX_VIDEO_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_LABEL,
  VIDEO_UPLOAD_CHUNK_BYTES,
  getVideoSizeError,
} from "@/lib/video-upload";
import {
  resolveBatchVideoObjectKey,
  resolveLiveClassVideoObjectKey,
  VideoUploadAuthError,
} from "@/lib/video-upload-server";
import { getMentorCourseIds } from "@/lib/mentor-courses";
import { readApiJson } from "@/lib/api-url-transport";

const UPLOAD_ROLES = ["super_admin", "manager", "mentor"] as const;
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
]);

function normalizeVideoContentType(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const base = s.split(";")[0]?.trim() || "";
  if (ALLOWED_VIDEO_TYPES.has(base)) return base;
  if (base.includes("webm")) return "video/webm";
  return "video/mp4";
}

/** Diagnostic: service-account IAM on the video bucket. */
export async function handleVideoResumableGet() {
  const { error } = await requireAuth([...UPLOAD_ROLES]);
  if (error) return error;

  const configError = getGcsUploadConfigError();
  if (configError) {
    return NextResponse.json(
      { ok: false, error: configError, canUpload: false },
      { status: 503 }
    );
  }

  const check = await checkVideoBucketPermissions();
  return NextResponse.json(
    {
      ok: check.canUpload,
      maxBytes: MAX_VIDEO_UPLOAD_BYTES,
      maxLabel: MAX_VIDEO_UPLOAD_LABEL,
      chunkBytes: VIDEO_UPLOAD_CHUNK_BYTES,
      ...check,
      hint: check.canUpload
        ? "Service account can write to the bucket. Uploads should work."
        : `Grant the service account ${check.missing.join(", ") || "storage.objects.create"} on gs://${check.bucketName} (roles/storage.objectAdmin), then retry.`,
    },
    { status: check.canUpload ? 200 : 503 }
  );
}

/**
 * Start a GCS resumable session. Storage failures use 503, not 403, so
 * Hostinger ModSecurity does not replace the JSON body with an HTML block page.
 */
export async function handleVideoResumablePost(request: Request) {
  const { error, session } = await requireAuth([...UPLOAD_ROLES]);
  if (error) return error;

  try {
    const configError = getGcsUploadConfigError();
    if (configError) {
      return NextResponse.json({ error: configError }, { status: 503 });
    }

    const body = (await readApiJson(request)) as
      | {
          batchId?: unknown;
          liveClassId?: unknown;
          filename?: unknown;
          contentType?: unknown;
          fileSize?: unknown;
        }
      | null;

    const batchId = typeof body?.batchId === "string" ? body.batchId.trim() : "";
    const liveClassId = typeof body?.liveClassId === "string" ? body.liveClassId.trim() : "";
    const filename = typeof body?.filename === "string" ? body.filename.trim() : "";
    const contentType = normalizeVideoContentType(body?.contentType);
    const fileSize = typeof body?.fileSize === "number" ? body.fileSize : Number(body?.fileSize);

    if ((!batchId && !liveClassId) || !filename) {
      return NextResponse.json(
        { error: "filename and batchId or liveClassId are required." },
        { status: 400 }
      );
    }

    const sizeError = getVideoSizeError(fileSize);
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 413 });
    }

    const mentorOpts =
      session!.user.role === "mentor"
        ? {
            mentorCourseIds: await getMentorCourseIds(session!.user.id),
            mentorUserId: session!.user.id,
          }
        : undefined;

    const { objectKey, folderName, safeFilename } = liveClassId
      ? await resolveLiveClassVideoObjectKey(liveClassId, filename, mentorOpts)
      : await resolveBatchVideoObjectKey(batchId, filename, mentorOpts);

    const origin = request.headers.get("origin")?.trim() || getAppUrl();

    let uploadUrl: string;
    try {
      uploadUrl = await createResumableUploadSession({
        objectKey,
        contentType,
        contentLength: Math.floor(fileSize),
        origin,
      });
    } catch (sessionErr: unknown) {
      const err = sessionErr as { code?: number; response?: { status?: number }; message?: string };
      const status = Number(err?.code ?? err?.response?.status);
      const check = await checkVideoBucketPermissions();
      const message =
        status === 403
          ? `Storage permission denied: ${check.serviceAccount ?? "the service account"} ` +
            `cannot create objects in gs://${check.bucketName}. ` +
            `Grant it roles/storage.objectAdmin on that bucket (not Google OAuth), then retry.`
          : err?.message || "Failed to start the video upload session.";
      return NextResponse.json({ error: message, permissionCheck: check }, { status: 503 });
    }

    return NextResponse.json({
      uploadUrl,
      objectKey,
      folderName,
      safeFilename,
      chunkBytes: VIDEO_UPLOAD_CHUNK_BYTES,
      maxBytes: MAX_VIDEO_UPLOAD_BYTES,
    });
  } catch (err: unknown) {
    if (err instanceof VideoUploadAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status === 403 ? 409 : err.status });
    }
    console.error("[video-resumable error]", err);
    return NextResponse.json(
      { error: "Failed to start the video upload session." },
      { status: 500 }
    );
  }
}
