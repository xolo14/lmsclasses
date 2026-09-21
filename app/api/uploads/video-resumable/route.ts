import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getAppUrl } from "@/lib/app-url";
import { checkVideoBucketPermissions, createResumableUploadSession } from "@/lib/gcs";
import {
  MAX_VIDEO_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_LABEL,
  VIDEO_UPLOAD_CHUNK_BYTES,
  getVideoSizeError,
} from "@/lib/video-upload";
import { resolveBatchVideoObjectKey, resolveLiveClassVideoObjectKey, VideoUploadAuthError } from "@/lib/video-upload-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/**
 * Diagnostic: does the configured service account have the bucket permissions
 * needed to upload? Open /api/uploads/video-resumable in the browser while
 * logged in as an admin to recheck after changing IAM on GCP.
 */
export async function GET() {
  const { error } = await requireAuth([...UPLOAD_ROLES]);
  if (error) return error;

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
 * Start a server-authorised GCS resumable upload session for a recorded class.
 * The browser uploads the file bytes in chunks directly to the returned
 * `uploadUrl`; nothing passes through this Node process.
 */
export async function POST(request: Request) {
  const { error, session } = await requireAuth([...UPLOAD_ROLES]);
  if (error) return error;

  try {
    const body = (await request.json().catch(() => null)) as
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
        ? { mentorCourseId: session!.user.courseId, mentorUserId: session!.user.id }
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
    } catch (sessionErr: any) {
      // GCS enforces storage.objects.create when the session is created, so a
      // 403 here means the service account is missing bucket IAM — explain it.
      const status = Number(sessionErr?.code ?? sessionErr?.response?.status);
      if (status === 403) {
        const check = await checkVideoBucketPermissions();
        return NextResponse.json(
          {
            error:
              `Storage permission denied: ${check.serviceAccount ?? "the service account"} ` +
              `cannot create objects in gs://${check.bucketName}. ` +
              `Grant it roles/storage.objectAdmin in Google Cloud IAM and try again.`,
            permissionCheck: check,
          },
          { status: 403 }
        );
      }
      throw sessionErr;
    }

    return NextResponse.json({
      uploadUrl,
      objectKey,
      folderName,
      safeFilename,
      chunkBytes: VIDEO_UPLOAD_CHUNK_BYTES,
      maxBytes: MAX_VIDEO_UPLOAD_BYTES,
    });
  } catch (err: any) {
    if (err instanceof VideoUploadAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[video-resumable error]", err);
    return NextResponse.json(
      { error: "Failed to start the video upload session." },
      { status: 500 }
    );
  }
}
