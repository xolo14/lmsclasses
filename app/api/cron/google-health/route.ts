import { NextResponse } from "next/server";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { googleConnections } from "@/lib/db/schema";
import { requireCronSecret } from "@/lib/cron-auth";
import { isGoogleConfigured, refreshConnection } from "@/lib/services/googleAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET|POST /api/cron/google-health  (daily, Bearer CRON_SECRET)
 * Refreshes tokens for active connections not used in 30+ days so revoked/expired refresh tokens
 * (e.g. 7-day expiry for External/Testing OAuth apps) are detected early. A failing refresh flips
 * the row to needs_reconnect and emails the user (inside withGoogle → markNeedsReconnect).
 */
export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  if (!isGoogleConfigured()) return NextResponse.json({ ok: true, skipped: "google_not_configured" });

  const stale = await db
    .select({
      id: googleConnections.id,
      userId: googleConnections.userId,
      isPlatformAccount: googleConnections.isPlatformAccount,
    })
    .from(googleConnections)
    .where(
      and(
        eq(googleConnections.status, "active"),
        or(
          isNull(googleConnections.lastUsedAt),
          lt(googleConnections.lastUsedAt, sql`NOW() - INTERVAL '30 days'`)
        )!
      )
    )
    .limit(50);

  const started = Date.now();
  const summary = { checked: 0, healthy: 0, needsReconnect: 0 };
  for (const row of stale) {
    if (Date.now() - started > 45_000) break;
    summary.checked += 1;
    const ok = await refreshConnection(row.userId, { platform: row.isPlatformAccount });
    if (ok) {
      summary.healthy += 1;
      await db.update(googleConnections).set({ lastUsedAt: new Date() }).where(eq(googleConnections.id, row.id));
    } else {
      summary.needsReconnect += 1;
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(request: Request) {
  return GET(request);
}
