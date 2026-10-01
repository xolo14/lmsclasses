import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { liveClasses } from "@/lib/db/schema";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { retryForClass } from "@/lib/services/liveClassGoogleSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/live-classes/[id]/retry-meet
 * Re-attempts Google event + Meet creation for a pending/failed class. Mentors: own classes only.
 * Runs synchronously (bounded by withGoogle retries) so the UI can show the result.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth(["super_admin", "manager", "mentor"]);
  if (error) return error;
  const user = session!.user;
  const { id } = await params;

  const limit = checkRateLimit(`google:retry:${user.id}`, 10, 5 * 60 * 1000);
  if (!limit.allowed) {
    const r = rateLimitResponse(limit.retryAfterSec, "Too many retries. Wait a few minutes.");
    return NextResponse.json(r.body, { status: r.status, headers: r.headers });
  }

  const [cls] = await db
    .select({ id: liveClasses.id, mentorId: liveClasses.mentorId, hostUserId: liveClasses.hostUserId })
    .from(liveClasses)
    .where(and(eq(liveClasses.id, id), isNull(liveClasses.deletedAt)))
    .limit(1);
  if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "mentor" && cls.mentorId !== user.id && cls.hostUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const outcome = await retryForClass(id, { actor: { id: user.id, role: user.role } });
  const [updated] = await db
    .select({
      meetStatus: liveClasses.meetStatus,
      meetError: liveClasses.meetError,
      meetingLink: liveClasses.meetingLink,
      calendarHtmlLink: liveClasses.calendarHtmlLink,
    })
    .from(liveClasses)
    .where(eq(liveClasses.id, id))
    .limit(1);

  return NextResponse.json({ ok: outcome.ok, message: outcome.ok ? "Meet link created." : outcome.message, ...updated });
}
