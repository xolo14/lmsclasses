import { NextResponse } from "next/server";
import { and, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { liveClasses } from "@/lib/db/schema";
import { requireCronSecret } from "@/lib/cron-auth";
import { isGoogleConfigured } from "@/lib/services/googleAuth";
import { createForClass, MAX_MEET_RETRIES } from "@/lib/services/liveClassGoogleSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Exponential backoff between attempts: 2, 6, 18, 54, 162 minutes (capped). */
function backoffMinutes(retryCount: number): number {
  return Math.min(180, 2 * Math.pow(3, retryCount));
}

/**
 * GET|POST /api/cron/google-retry  (every 10 minutes, Bearer CRON_SECRET)
 * Re-attempts Meet creation for pending/failed classes that start in the future and have not
 * exhausted MAX_MEET_RETRIES. The 5th failure emails the host + Super Admins (inside createForClass).
 * Hosts without an active Google connection are skipped cheaply (no retry consumed).
 */
export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  if (!isGoogleConfigured()) return NextResponse.json({ ok: true, skipped: "google_not_configured" });

  const now = new Date();
  const candidates = await db
    .select({ id: liveClasses.id, retryCount: liveClasses.retryCount, lastAttemptAt: liveClasses.lastAttemptAt, meetStatus: liveClasses.meetStatus })
    .from(liveClasses)
    .where(
      and(
        isNull(liveClasses.deletedAt),
        inArray(liveClasses.status, ["scheduled", "live"]),
        inArray(liveClasses.meetStatus, ["pending", "failed"]),
        gt(liveClasses.scheduledAt, now),
        lt(liveClasses.retryCount, MAX_MEET_RETRIES),
        or(isNull(liveClasses.lastAttemptAt), sql`${liveClasses.lastAttemptAt} < NOW() - INTERVAL '2 minutes'`)!
      )
    )
    .orderBy(liveClasses.scheduledAt)
    .limit(100);

  const started = Date.now();
  const summary = { considered: candidates.length, attempted: 0, created: 0, waitingHost: 0, failed: 0, deferred: 0 };

  for (const c of candidates) {
    // Leave headroom under the gateway timeout; the next run picks up the rest.
    if (Date.now() - started > 45_000) break;

    // Failed rows wait for their backoff window; pending rows (host not connected / provisioning) are cheap.
    if (c.meetStatus === "failed" && c.lastAttemptAt) {
      const waitMs = backoffMinutes(c.retryCount) * 60_000;
      if (Date.now() - c.lastAttemptAt.getTime() < waitMs) {
        summary.deferred += 1;
        continue;
      }
    }

    summary.attempted += 1;
    const outcome = await createForClass(c.id);
    if (outcome.ok) summary.created += 1;
    else if (outcome.reason === "host_not_connected") summary.waitingHost += 1;
    else if (outcome.reason === "failed") summary.failed += 1;
  }

  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(request: Request) {
  return GET(request);
}
