import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { emptyGoogleStatus, getGoogleStatusForUser } from "@/lib/actions/googleIntegration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/google/status — the caller's own connection summary. Never includes tokens. */
export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;
  try {
    const payload = await getGoogleStatusForUser(session!.user.id, session!.user.role);
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[google/status]", err);
    return NextResponse.json(emptyGoogleStatus(session!.user.role), {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
