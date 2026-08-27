import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  LMS_SIGNED_URL_TTL_MS,
  getSignedReadUrl,
  parseGcsObjectKey,
} from "@/lib/gcs";
import { isPublicCourseDemoReference } from "@/lib/public-demo-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns a short-lived V4 signed URL for a private GCS object.
 * Auth: logged-in LMS user, OR anonymous when videoKey is a published course demo.
 * Query: ?videoKey=<object path | gs:// | storage.googleapis.com URL>
 */
export async function GET(request: Request) {
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

    const session = await auth();
    if (!session?.user) {
      const isDemo = await isPublicCourseDemoReference(videoKey);
      if (!isDemo) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const url = await getSignedReadUrl(videoKey, LMS_SIGNED_URL_TTL_MS);
    return NextResponse.json({
      url,
      expiresAt: new Date(Date.now() + LMS_SIGNED_URL_TTL_MS).toISOString(),
    });
  } catch (err) {
    console.error("[api/video] signed URL error:", err);
    return NextResponse.json(
      { error: "Failed to generate access URL" },
      { status: 500 }
    );
  }
}
