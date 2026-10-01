import { NextResponse } from "next/server";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { googleConnections, liveClasses, users } from "@/lib/db/schema";
import { isGmailAddress, isGoogleConfigured } from "@/lib/services/googleAuth";
import { GOOGLE_HOST_ROLES } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/super-admin/google-connections
 * Every host-capable user with their Google connection state + how many upcoming classes depend
 * on them. Never includes tokens.
 */
export async function GET() {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;

  const now = new Date();
  const [hosts, upcoming, meetStats, createdThisMonth, failedByHost] = await Promise.all([
    db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        connectionId: googleConnections.id,
        googleEmail: googleConnections.googleEmail,
        status: googleConnections.status,
        lastError: googleConnections.lastError,
        connectedAt: googleConnections.connectedAt,
        lastUsedAt: googleConnections.lastUsedAt,
        scopes: googleConnections.scopes,
      })
      .from(users)
      .leftJoin(
        googleConnections,
        and(eq(googleConnections.userId, users.id), eq(googleConnections.isPlatformAccount, false))
      )
      .where(and(inArray(users.role, [...GOOGLE_HOST_ROLES]), isNull(users.deletedAt)))
      .orderBy(users.role, users.name),
    db
      .select({ hostUserId: liveClasses.hostUserId, count: sql<number>`count(*)::int` })
      .from(liveClasses)
      .where(
        and(
          isNull(liveClasses.deletedAt),
          gt(liveClasses.scheduledAt, now),
          inArray(liveClasses.status, ["scheduled", "live"]),
          inArray(liveClasses.meetStatus, ["created", "pending", "failed"])
        )
      )
      .groupBy(liveClasses.hostUserId),
    db
      .select({ meetStatus: liveClasses.meetStatus, count: sql<number>`count(*)::int` })
      .from(liveClasses)
      .where(and(isNull(liveClasses.deletedAt), gt(liveClasses.scheduledAt, now), inArray(liveClasses.status, ["scheduled", "live"])))
      .groupBy(liveClasses.meetStatus),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(liveClasses)
      .where(
        and(
          isNull(liveClasses.deletedAt),
          eq(liveClasses.meetStatus, "created"),
          sql`${liveClasses.googleSyncedAt} >= date_trunc('month', NOW())`
        )
      ),
    db
      .select({ hostUserId: liveClasses.hostUserId, count: sql<number>`count(*)::int` })
      .from(liveClasses)
      .where(
        and(
          isNull(liveClasses.deletedAt),
          eq(liveClasses.meetStatus, "failed"),
          gt(liveClasses.scheduledAt, now)
        )
      )
      .groupBy(liveClasses.hostUserId),
  ]);

  const upcomingByHost = new Map(upcoming.map((u) => [u.hostUserId, Number(u.count)]));
  const failedMap = new Map(failedByHost.map((u) => [u.hostUserId, Number(u.count)]));
  const rows = hosts.map((h) => ({
    userId: h.userId,
    name: h.name,
    email: h.email,
    role: h.role,
    isActive: h.isActive !== false,
    connected: h.status === "active",
    status: h.status ?? null,
    googleEmail: h.googleEmail ?? null,
    isGmail: isGmailAddress(h.googleEmail),
    lastError: h.status && h.status !== "active" ? h.lastError : null,
    connectedAt: h.connectedAt?.toISOString() ?? null,
    lastUsedAt: h.lastUsedAt?.toISOString() ?? null,
    freebusy: (h.scopes ?? []).some((s) => s.includes("calendar.freebusy")),
    upcomingHostedClasses: upcomingByHost.get(h.userId) ?? 0,
    failedMeetCreations: failedMap.get(h.userId) ?? 0,
  }));

  const stats = {
    configured: isGoogleConfigured(),
    hosts: rows.length,
    connected: rows.filter((r) => r.connected).length,
    needsReconnect: rows.filter((r) => r.status === "needs_reconnect").length,
    notConnected: rows.filter((r) => !r.status).length,
    upcomingMeetCreated: Number(meetStats.find((m) => m.meetStatus === "created")?.count ?? 0),
    upcomingMeetPending: Number(meetStats.find((m) => m.meetStatus === "pending")?.count ?? 0),
    upcomingMeetFailed: Number(meetStats.find((m) => m.meetStatus === "failed")?.count ?? 0),
    upcomingManual: Number(meetStats.find((m) => m.meetStatus === "manual")?.count ?? 0),
    missingMeetLink:
      Number(meetStats.find((m) => m.meetStatus === "pending")?.count ?? 0) +
      Number(meetStats.find((m) => m.meetStatus === "failed")?.count ?? 0),
    createdThisMonth: Number(createdThisMonth[0]?.count ?? 0),
  };

  return NextResponse.json({ stats, rows }, { headers: { "Cache-Control": "no-store" } });
}
