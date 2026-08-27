import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getSignedReadUrl, parseGcsObjectKey } from "@/lib/gcs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns a short-lived V4 signed URL for a private GCS object.
 * Auth: any logged-in LMS user (students play enrolled content; staff preview).
 * Query: ?videoKey=<object path | gs:// | storage.googleapis.com URL>
 */
export async function GET(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const videoKey = searchParams.get("videoKey")?.trim();

    if (!videoKey) {
      return NextResponse.json(
        { error: "Missing videoKey parameter" },
        { status: 400 }
      );
    }

    if (!parseGcsObjectKey(videoKey)) {
      return NextResponse.json(
        { error: "videoKey must be a GCS object in the configured bucket" },
        { status: 400 }
      );
    }

    const url = await getSignedReadUrl(videoKey);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[api/video] signed URL error:", err);
    return NextResponse.json(
      { error: "Failed to generate access URL" },
      { status: 500 }
    );
  }
}
