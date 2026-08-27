import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  LMS_SIGNED_URL_TTL_MS,
  getGcsEnvStatus,
  getSignedReadUrl,
  parseGcsObjectKey,
} from "@/lib/gcs";
import { isPublicCourseDemoReference } from "@/lib/public-demo-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeSignError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Never echo key material; keep actionable Google/error text.
  return msg
    .replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, "[PEM]")
    .slice(0, 300);
}

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
        { error: "Missing videoKey parameter", code: "MISSING_KEY" },
        { status: 400 }
      );
    }

    if (!parseGcsObjectKey(videoKey)) {
      return NextResponse.json(
        {
          error: "videoKey must be a GCS object in the configured bucket",
          code: "INVALID_KEY",
        },
        { status: 400 }
      );
    }

    const session = await auth();
    if (!session?.user) {
      const isDemo = await isPublicCourseDemoReference(videoKey);
      if (!isDemo) {
        return NextResponse.json(
          { error: "Unauthorized", code: "UNAUTHORIZED" },
          { status: 401 }
        );
      }
    }

    const gcs = getGcsEnvStatus();
    if (!gcs.configured) {
      return NextResponse.json(
        {
          error:
            "GCS env vars missing or private key invalid on the server. Check GCP_* in hPanel and Restart Node.",
          code: "GCS_NOT_CONFIGURED",
          gcs: {
            projectIdSet: gcs.projectIdSet,
            clientEmailSet: gcs.clientEmailSet,
            privateKeySet: gcs.privateKeySet,
            privateKeyLooksValid: gcs.privateKeyLooksValid,
            privateKeyLength: gcs.privateKeyLength,
            bucketName: gcs.bucketName,
          },
        },
        { status: 500 }
      );
    }

    const url = await getSignedReadUrl(videoKey, LMS_SIGNED_URL_TTL_MS);
    return NextResponse.json({
      url,
      expiresAt: new Date(Date.now() + LMS_SIGNED_URL_TTL_MS).toISOString(),
    });
  } catch (err) {
    console.error("[api/video] signed URL error:", err);
    const detail = sanitizeSignError(err);
    return NextResponse.json(
      {
        error: "Failed to generate access URL",
        code: "SIGN_FAILED",
        detail,
        gcs: getGcsEnvStatus(),
      },
      { status: 500 }
    );
  }
}
