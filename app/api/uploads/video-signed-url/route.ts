import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getSignedUploadUrl, UPLOAD_SIGNED_URL_TTL_MS } from "@/lib/gcs";
import { MAX_VIDEO_UPLOAD_BYTES, getVideoSizeError } from "@/lib/video-upload";
import { resolveBatchVideoObjectKey } from "@/lib/video-upload-server";
import { getMentorCourseIds } from "@/lib/mentor-courses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Legacy single-PUT signed URL flow. The recording modal now uses
 * /api/uploads/video-resumable (chunked, retryable, no bucket CORS needed);
 * this stays for callers that still rely on a plain signed PUT.
 * Note: signed PUTs require CORS to be configured on the bucket.
 */
export async function POST(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager", "mentor"]);
  if (error) return error;

  try {
    const body = await request.json();
    const { batchId, filename, contentType, fileSize } = body ?? {};

    if (!batchId || !filename) {
      return NextResponse.json(
        { error: "batchId and filename are required." },
        { status: 400 }
      );
    }

    // fileSize is optional for backwards compatibility, but enforced when provided.
    if (fileSize !== undefined && fileSize !== null) {
      const sizeError = getVideoSizeError(Number(fileSize));
      if (sizeError) {
        return NextResponse.json({ error: sizeError }, { status: 413 });
      }
    }

    const { objectKey, folderName, safeFilename } = await resolveBatchVideoObjectKey(
      String(batchId),
      String(filename),
      session!.user.role === "mentor"
        ? { mentorCourseIds: await getMentorCourseIds(session!.user.id) }
        : undefined
    );

    const mimeType = (typeof contentType === "string" && contentType.trim()) || "video/mp4";
    const signedUrl = await getSignedUploadUrl({
      objectKey,
      contentType: mimeType,
      expiresMs: UPLOAD_SIGNED_URL_TTL_MS,
    });

    return NextResponse.json({
      signedUrl,
      objectKey,
      folderName,
      safeFilename,
      maxBytes: MAX_VIDEO_UPLOAD_BYTES,
    });
  } catch (err: any) {
    console.error("[video-signed-url error]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate signed upload URL." },
      { status: 500 }
    );
  }
}
