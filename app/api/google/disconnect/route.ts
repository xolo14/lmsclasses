import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getClientIp, logAction } from "@/lib/audit";
import { disconnectGoogleForUser, disconnectPlatformGoogle } from "@/lib/actions/googleIntegration";
import { scrubGoogleError } from "@/lib/services/googleErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/google/disconnect — revokes at Google, deletes local tokens.
 * Returns how many upcoming hosted classes lose automatic Meet management.
 */
export async function POST(request: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;
  const user = session!.user;
  const url = new URL(request.url);
  const platform = url.searchParams.get("platform") === "1" || url.searchParams.get("platform") === "true";

  if (platform && user.role !== "super_admin") {
    return NextResponse.json({ error: "Only Super Admins can disconnect the platform account." }, { status: 403 });
  }

  try {
    const result = platform ? await disconnectPlatformGoogle() : await disconnectGoogleForUser(user.id);
    void logAction({
      userId: user.id,
      role: user.role,
      action: platform ? "google.platform_disconnected" : "google.disconnected",
      entity: "google_connection",
      entityId: user.id,
      metadata: result,
      ipAddress: getClientIp(request),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[google] disconnect failed", scrubGoogleError(err));
    return NextResponse.json({ error: "Failed to disconnect Google. Please try again." }, { status: 500 });
  }
}
