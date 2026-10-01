import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { liveClasses, users, type GoogleConnectionStatus, type Role } from "@/lib/db/schema";
import { canHostLiveClass, integrationsPathForRole, ROLE_ROUTES } from "@/lib/utils";
import {
  GOOGLE_SCOPE_CALENDAR_EVENTS,
  GOOGLE_SCOPE_FREEBUSY,
  freeBusyEnabled,
  getConnection,
  getPlatformConnection,
  isGmailAddress,
  isGoogleConfigured,
  getGoogleOAuthStatus,
  type GoogleOAuthStatus,
  revokeAndDeleteConnection,
  revokeAndDeletePlatformConnection,
  scopesGranted,
} from "@/lib/services/googleAuth";
import { getDefaultMeetMode, getPlatformGoogleEmail, type DefaultMeetMode } from "@/lib/google-platform";

/**
 * Server-side helpers shared by the /api/google/* routes and server components.
 * Nothing here ever returns a token. Role/org checks happen in the callers with the session.
 */

export type GoogleStatusPayload = {
  /** Env vars present — when false the UI shows "not configured" instead of a connect button. */
  configured: boolean;
  /** Google Calendar/Meet OAuth only. Video uploads use a separate GCS service account. */
  oauth: GoogleOAuthStatus;
  /** Whether this role can own a Google calendar event. Students always get false. */
  canHost: boolean;
  connected: boolean;
  status: GoogleConnectionStatus | null;
  googleEmail: string | null;
  connectedAt: string | null;
  lastUsedAt: string | null;
  lastError: string | null;
  scopes: { calendarEvents: boolean; freebusy: boolean };
  freebusyEnabled: boolean;
  isGmail: boolean;
  integrationsPath: string;
  platformEmail: string;
  defaultMeetMode: DefaultMeetMode;
  platformConnected: boolean;
  platformIsGmail: boolean;
  platform: {
    connected: boolean;
    status: GoogleConnectionStatus | null;
    googleEmail: string | null;
    connectedAt: string | null;
    lastUsedAt: string | null;
    lastError: string | null;
    isGmail: boolean;
  } | null;
};

export function emptyGoogleStatus(role: Role, configured = isGoogleConfigured()): GoogleStatusPayload {
  const platformEmail = getPlatformGoogleEmail();
  const canHost = canHostLiveClass(role);
  const oauth = getGoogleOAuthStatus();
  return {
    configured: configured && oauth.configured,
    oauth,
    canHost,
    connected: false,
    status: null,
    googleEmail: null,
    connectedAt: null,
    lastUsedAt: null,
    lastError: null,
    scopes: { calendarEvents: false, freebusy: false },
    freebusyEnabled: freeBusyEnabled(),
    isGmail: false,
    integrationsPath: integrationsPathForRole(role),
    platformEmail,
    defaultMeetMode: "google_platform",
    platformConnected: false,
    platformIsGmail: isGmailAddress(platformEmail),
    platform:
      role === "super_admin"
        ? {
            connected: false,
            status: null,
            googleEmail: platformEmail,
            connectedAt: null,
            lastUsedAt: null,
            lastError: null,
            isGmail: isGmailAddress(platformEmail),
          }
        : null,
  };
}

export async function getGoogleStatusForUser(userId: string, role: Role): Promise<GoogleStatusPayload> {
  const configured = isGoogleConfigured();
  const canHost = canHostLiveClass(role);
  const platformEmail = getPlatformGoogleEmail();

  let defaultMeetMode: DefaultMeetMode = "google_platform";
  let platformRow = null;
  try {
    [defaultMeetMode, platformRow] = await Promise.all([getDefaultMeetMode(), getPlatformConnection()]);
  } catch (err) {
    console.warn("[google-status] schema lookup failed; returning unconfigured status", err);
    return emptyGoogleStatus(role, configured);
  }

  const platform =
    role === "super_admin"
      ? {
          connected: platformRow?.status === "active",
          status: (platformRow?.status as GoogleConnectionStatus | undefined) ?? null,
          googleEmail: platformRow?.googleEmail ?? platformEmail,
          connectedAt: platformRow?.connectedAt?.toISOString() ?? null,
          lastUsedAt: platformRow?.lastUsedAt?.toISOString() ?? null,
          lastError: platformRow && platformRow.status !== "active" ? platformRow.lastError : null,
          isGmail: isGmailAddress(platformRow?.googleEmail ?? platformEmail),
        }
      : null;

  const base: GoogleStatusPayload = {
    ...emptyGoogleStatus(role, configured),
    defaultMeetMode,
    platformConnected: platformRow?.status === "active",
    platformIsGmail: isGmailAddress(platformRow?.googleEmail ?? platformEmail),
    platform,
  };
  if (!canHost) return base;

  try {
    const connection = await getConnection(userId);
    if (!connection) return base;

    return {
      ...base,
      connected: connection.status === "active",
      status: connection.status as GoogleConnectionStatus,
      googleEmail: connection.googleEmail,
      connectedAt: connection.connectedAt?.toISOString() ?? null,
      lastUsedAt: connection.lastUsedAt?.toISOString() ?? null,
      lastError: connection.status === "active" ? null : connection.lastError,
      scopes: {
        calendarEvents: scopesGranted(connection.scopes, [GOOGLE_SCOPE_CALENDAR_EVENTS]),
        freebusy: scopesGranted(connection.scopes, [GOOGLE_SCOPE_FREEBUSY]),
      },
      isGmail: isGmailAddress(connection.googleEmail),
    };
  } catch (err) {
    console.warn("[google-status] connection lookup failed; returning base status", err);
    return base;
  }
}

/**
 * Strict allow-list for post-OAuth redirects: same-origin path under the caller's own portal.
 * Anything else falls back to the role's integrations page.
 */
export function sanitizeReturnTo(raw: string | null | undefined, role: Role): string {
  const fallback = integrationsPathForRole(role);
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\s<>"'`]/.test(value) || value.includes("://")) return fallback;
  const prefix = ROLE_ROUTES[role];
  if (!prefix || !(value === prefix || value.startsWith(`${prefix}/`))) return fallback;
  // Path + optional query, conservative charset.
  if (!/^\/[A-Za-z0-9\-_/]*(\?[A-Za-z0-9\-_=&%.]*)?$/.test(value)) return fallback;
  return value.length > 300 ? fallback : value;
}

/** Upcoming classes whose Meet link depends on this host's Google connection. */
export async function countUpcomingHostedClasses(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(liveClasses)
    .where(
      and(
        eq(liveClasses.hostUserId, userId),
        isNull(liveClasses.deletedAt),
        gt(liveClasses.scheduledAt, new Date()),
        inArray(liveClasses.meetStatus, ["created", "pending", "failed"])
      )
    );
  return Number(row?.count ?? 0);
}

/** Email a host to connect or reconnect Google. Used by Super Admin "Send reminder". */
export async function sendReconnectReminder(userId: string): Promise<{ sent: boolean; kind: "connect" | "reconnect" }> {
  const { sendGoogleHostConnectEmail, sendGoogleReconnectEmail } = await import("@/lib/email");
  const { formatDateTime } = await import("@/lib/utils");

  const [target] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  if (!target || !canHostLiveClass(target.role)) {
    throw new Error("User cannot host live classes");
  }

  const connection = await getConnection(userId);
  if (connection?.status === "active") {
    throw new Error("This user is already connected.");
  }

  const integrationsPath = integrationsPathForRole(target.role);
  if (connection?.status === "needs_reconnect") {
    await sendGoogleReconnectEmail({
      email: target.email,
      name: target.name,
      reason: connection.lastError ?? undefined,
      integrationsPath,
    });
    return { sent: true, kind: "reconnect" };
  }

  const [waiting] = await db
    .select({ title: liveClasses.title, scheduledAt: liveClasses.scheduledAt })
    .from(liveClasses)
    .where(
      and(
        eq(liveClasses.hostUserId, userId),
        isNull(liveClasses.deletedAt),
        gt(liveClasses.scheduledAt, new Date()),
        inArray(liveClasses.meetStatus, ["pending", "failed"])
      )
    )
    .orderBy(sql`${liveClasses.scheduledAt} asc`)
    .limit(1);

  await sendGoogleHostConnectEmail({
    email: target.email,
    name: target.name,
    classTitle: waiting?.title,
    scheduledAt: waiting ? formatDateTime(waiting.scheduledAt) : undefined,
    integrationsPath,
  });
  return { sent: true, kind: "connect" };
}

export async function disconnectGoogleForUser(userId: string): Promise<{ revokedAtGoogle: boolean; affectedUpcomingClasses: number }> {
  const affectedUpcomingClasses = await countUpcomingHostedClasses(userId);
  const { revokedAtGoogle } = await revokeAndDeleteConnection(userId);
  return { revokedAtGoogle, affectedUpcomingClasses };
}

export async function countUpcomingPlatformClasses(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(liveClasses)
    .where(
      and(
        eq(liveClasses.googleOrganizerEmail, getPlatformGoogleEmail()),
        isNull(liveClasses.deletedAt),
        gt(liveClasses.scheduledAt, new Date()),
        inArray(liveClasses.meetStatus, ["created", "pending", "failed"])
      )
    );
  return Number(row?.count ?? 0);
}

export async function disconnectPlatformGoogle(): Promise<{ revokedAtGoogle: boolean; affectedUpcomingClasses: number }> {
  const affectedUpcomingClasses = await countUpcomingPlatformClasses();
  const { revokedAtGoogle } = await revokeAndDeletePlatformConnection();
  return { revokedAtGoogle, affectedUpcomingClasses };
}
