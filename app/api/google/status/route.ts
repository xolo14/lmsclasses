import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getGoogleStatusForUser } from "@/lib/actions/googleIntegration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/google/status — the caller's own connection summary. Never includes tokens. */
export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;
  const payload = await getGoogleStatusForUser(session!.user.id, session!.user.role);
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
