import { google } from "googleapis";
import type { OAuth2Client, Credentials } from "google-auth-library";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { googleConnections, users, type GoogleConnection } from "@/lib/db/schema";
import { logAction } from "@/lib/audit";
import { getPlatformGoogleEmail } from "@/lib/google-platform";
import { integrationsPathForRole } from "@/lib/utils";
import { decrypt, encrypt, isTokenEncryptionConfigured } from "@/lib/services/crypto";
import { cleanEnvValue } from "@/lib/env-value";
import {
  GoogleConfigError,
  GoogleNotConnectedError,
  GoogleQuotaError,
  GoogleReconnectRequiredError,
  googleErrorStatus,
  googleRetryAfterSeconds,
  isInsufficientScope,
  isInvalidGrant,
  isRateLimited,
  isTransientNetworkError,
  scrubGoogleError,
} from "@/lib/services/googleErrors";

/* ------------------------------------------------------------------ */
/* Scopes + config                                                     */
/* ------------------------------------------------------------------ */

export const GOOGLE_SCOPE_OPENID = "openid";
export const GOOGLE_SCOPE_EMAIL = "email";
export const GOOGLE_SCOPE_CALENDAR_EVENTS = "https://www.googleapis.com/auth/calendar.events";
export const GOOGLE_SCOPE_FREEBUSY = "https://www.googleapis.com/auth/calendar.freebusy";

/** Google returns `email` as this full URI in `tokens.scope`. */
const USERINFO_EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

export function freeBusyEnabled(): boolean {
  return (process.env.ENABLE_FREEBUSY ?? "").trim().toLowerCase() === "true";
}

/** Scopes requested at consent time. */
export function requestedScopes(): string[] {
  const scopes = [GOOGLE_SCOPE_OPENID, GOOGLE_SCOPE_EMAIL, GOOGLE_SCOPE_CALENDAR_EVENTS];
  if (freeBusyEnabled()) scopes.push(GOOGLE_SCOPE_FREEBUSY);
  return scopes;
}

/** Scopes that must be granted for the integration to work at all. */
export function requiredScopes(): string[] {
  return [GOOGLE_SCOPE_CALENDAR_EVENTS];
}

export function scopesGranted(granted: string[], needed: string[]): boolean {
  const set = new Set(granted.map(normalizeScope));
  return needed.every((s) => set.has(normalizeScope(s)));
}

export function normalizeScope(scope: string): string {
  if (scope === GOOGLE_SCOPE_EMAIL) return USERINFO_EMAIL_SCOPE;
  return scope;
}

export function parseScopeString(scope: string | null | undefined): string[] {
  return (scope ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type GoogleEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string;
};

function readEnv(): GoogleEnv | null {
  const clientId = cleanEnvValue(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET);
  const redirectUri = cleanEnvValue(process.env.GOOGLE_REDIRECT_URI);
  const stateSecret = cleanEnvValue(process.env.GOOGLE_STATE_SECRET);
  if (!clientId || !clientSecret || !redirectUri || !stateSecret) return null;
  return { clientId, clientSecret, redirectUri, stateSecret };
}

export type GoogleOAuthStatus = {
  configured: boolean;
  clientIdSet: boolean;
  clientSecretSet: boolean;
  redirectUriSet: boolean;
  redirectUri: string | null;
  stateSecretSet: boolean;
  encryptionKeySet: boolean;
  encryptionKeyValid: boolean;
  missing: string[];
  reason: string | null;
};

/** Google Calendar/Meet OAuth only — never includes GCS bucket credentials. */
export function getGoogleOAuthStatus(): GoogleOAuthStatus {
  const env = readEnv();
  const encryptionKeySet = !!cleanEnvValue(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY);
  const encryptionKeyValid = isTokenEncryptionConfigured();
  const missing: string[] = [];
  if (!env?.clientId) missing.push("GOOGLE_CLIENT_ID");
  if (!env?.clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
  if (!env?.redirectUri) missing.push("GOOGLE_REDIRECT_URI");
  if (!env?.stateSecret) missing.push("GOOGLE_STATE_SECRET");
  if (!encryptionKeyValid) missing.push("GOOGLE_TOKEN_ENCRYPTION_KEY");

  let reason: string | null = null;
  if (missing.length) {
    reason =
      encryptionKeySet && !encryptionKeyValid
        ? "GOOGLE_TOKEN_ENCRYPTION_KEY is set but is not 32 bytes (base64 or 64-char hex). This is OAuth token encryption only — not GCS."
        : `Google OAuth is incomplete: ${missing.join(", ")}. GCS_BUCKET_NAME / GCP_* are a separate video-storage setup.`;
  }

  return {
    configured: missing.length === 0,
    clientIdSet: !!env?.clientId,
    clientSecretSet: !!env?.clientSecret,
    redirectUriSet: !!env?.redirectUri,
    redirectUri: env?.redirectUri || null,
    stateSecretSet: !!env?.stateSecret,
    encryptionKeySet,
    encryptionKeyValid,
    missing,
    reason,
  };
}

/** True when every env var needed for Google OAuth is present and the encryption key is valid. */
export function isGoogleConfigured(): boolean {
  return getGoogleOAuthStatus().configured;
}

export function getGoogleEnv(): GoogleEnv {
  const env = readEnv();
  if (!env) {
    throw new GoogleConfigError(
      "Google integration is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI / GOOGLE_STATE_SECRET)."
    );
  }
  if (!isTokenEncryptionConfigured()) {
    throw new GoogleConfigError("GOOGLE_TOKEN_ENCRYPTION_KEY is missing or not 32 bytes.");
  }
  return env;
}

export function createOAuthClient(): OAuth2Client {
  const env = getGoogleEnv();
  return new google.auth.OAuth2(env.clientId, env.clientSecret, env.redirectUri);
}

/** Verifies an ID token from the token exchange and returns the Google identity. */
export async function verifyGoogleIdToken(idToken: string): Promise<{ sub: string; email: string; emailVerified: boolean }> {
  const env = getGoogleEnv();
  const client = createOAuthClient();
  const ticket = await client.verifyIdToken({ idToken, audience: env.clientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new GoogleConfigError("Google did not return a verified identity.");
  }
  return { sub: payload.sub, email: payload.email.toLowerCase(), emailVerified: payload.email_verified === true };
}

/* ------------------------------------------------------------------ */
/* Connection persistence                                              */
/* ------------------------------------------------------------------ */

export async function getConnection(userId: string): Promise<GoogleConnection | null> {
  const [row] = await db
    .select()
    .from(googleConnections)
    .where(and(eq(googleConnections.userId, userId), eq(googleConnections.isPlatformAccount, false)))
    .limit(1);
  return row ?? null;
}

export async function getPlatformConnection(): Promise<GoogleConnection | null> {
  const [row] = await db
    .select()
    .from(googleConnections)
    .where(eq(googleConnections.isPlatformAccount, true))
    .limit(1);
  return row ?? null;
}

export async function hasActivePlatformConnection(): Promise<boolean> {
  const c = await getPlatformConnection();
  return !!c && c.status === "active";
}

export async function getConnectionByGoogleSub(googleSub: string): Promise<GoogleConnection | null> {
  const [row] = await db.select().from(googleConnections).where(eq(googleConnections.googleSub, googleSub)).limit(1);
  return row ?? null;
}

export type UpsertConnectionInput = {
  userId: string;
  googleEmail: string;
  googleSub: string;
  refreshToken: string;
  accessToken?: string | null;
  accessTokenExpiresAt?: Date | null;
  scopes: string[];
};

/** Insert or replace the user's connection. Tokens are encrypted here; callers pass plaintext once. */
export async function upsertConnection(input: UpsertConnectionInput): Promise<GoogleConnection> {
  const now = new Date();
  const values = {
    userId: input.userId,
    googleEmail: input.googleEmail.toLowerCase(),
    googleSub: input.googleSub,
    refreshTokenEnc: encrypt(input.refreshToken),
    accessTokenEnc: input.accessToken ? encrypt(input.accessToken) : null,
    accessTokenExpiresAt: input.accessTokenExpiresAt ?? null,
    scopes: input.scopes,
    status: "active" as const,
    lastError: null,
    connectedAt: now,
    lastUsedAt: null,
    updatedAt: now,
  };
  const existing = await getConnection(input.userId);
  if (existing) {
    const [row] = await db
      .update(googleConnections)
      .set(values)
      .where(eq(googleConnections.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db.insert(googleConnections).values({ ...values, isPlatformAccount: false }).returning();
  return row;
}

export async function upsertPlatformConnection(input: UpsertConnectionInput): Promise<GoogleConnection> {
  const now = new Date();
  const values = {
    userId: input.userId,
    googleEmail: getPlatformGoogleEmail(),
    googleSub: input.googleSub,
    refreshTokenEnc: encrypt(input.refreshToken),
    accessTokenEnc: input.accessToken ? encrypt(input.accessToken) : null,
    accessTokenExpiresAt: input.accessTokenExpiresAt ?? null,
    scopes: input.scopes,
    status: "active" as const,
    lastError: null,
    isPlatformAccount: true,
    connectedAt: now,
    lastUsedAt: null,
    updatedAt: now,
  };
  const existing = await getPlatformConnection();
  if (existing) {
    const [row] = await db
      .update(googleConnections)
      .set(values)
      .where(eq(googleConnections.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db.insert(googleConnections).values(values).returning();
  return row;
}

export async function markNeedsReconnect(
  userId: string,
  reason: string,
  options: { platform?: boolean } = {}
): Promise<{ transitioned: boolean; connection: GoogleConnection | null }> {
  const existing = options.platform ? await getPlatformConnection() : await getConnection(userId);
  if (!existing) return { transitioned: false, connection: null };
  const transitioned = existing.status === "active";
  await db
    .update(googleConnections)
    .set({ status: "needs_reconnect", lastError: reason.slice(0, 500), updatedAt: new Date() })
    .where(eq(googleConnections.id, existing.id));
  if (transitioned) {
    void (async () => {
      if (existing.isPlatformAccount) {
        void logAction({
          userId: existing.userId,
          action: "google.platform_reconnect_needed",
          entity: "google_connection",
          entityId: existing.id,
          metadata: { reason, googleEmail: existing.googleEmail },
        });
        const { sendGoogleReconnectEmail } = await import("@/lib/email");
        const admins = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(and(eq(users.role, "super_admin"), eq(users.isActive, true)));
        for (const admin of admins) {
          if (!admin.email) continue;
          await sendGoogleReconnectEmail({
            email: admin.email,
            name: admin.name,
            reason: `Platform Google account (${getPlatformGoogleEmail()}): ${reason}`,
            integrationsPath: "/super-admin/settings/integrations",
          });
        }
        return;
      }
      const [user] = await db
        .select({ email: users.email, name: users.name, role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user?.email) return;
      const { sendGoogleReconnectEmail } = await import("@/lib/email");
      await sendGoogleReconnectEmail({
        email: user.email,
        name: user.name,
        reason,
        integrationsPath: integrationsPathForRole(user.role),
      });
    })().catch((err) => console.error("[google] reconnect email failed", err instanceof Error ? err.message : err));
  }
  return { transitioned, connection: { ...existing, status: "needs_reconnect", lastError: reason } };
}

async function persistTokens(connectionId: string, tokens: Credentials): Promise<void> {
  const set: Partial<typeof googleConnections.$inferInsert> = { updatedAt: new Date(), lastError: null };
  if (tokens.access_token) {
    set.accessTokenEnc = encrypt(tokens.access_token);
    set.accessTokenExpiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
  }
  if (tokens.refresh_token) set.refreshTokenEnc = encrypt(tokens.refresh_token);
  if (tokens.scope) set.scopes = parseScopeString(tokens.scope);
  try {
    await db.update(googleConnections).set(set).where(eq(googleConnections.id, connectionId));
  } catch (err) {
    console.error("[google] failed to persist refreshed tokens", err instanceof Error ? err.message : err);
  }
}

async function touchLastUsed(connectionId: string): Promise<void> {
  try {
    await db.update(googleConnections).set({ lastUsedAt: new Date() }).where(eq(googleConnections.id, connectionId));
  } catch {
    /* non-critical */
  }
}

/**
 * Returns an OAuth2Client with the user's credentials loaded.
 * Throws GoogleNotConnectedError / GoogleReconnectRequiredError so callers can mark the class
 * as failed with a clear reason.
 */
export async function getAuthorizedClient(
  userId: string,
  options: { platform?: boolean } = {}
): Promise<{ client: OAuth2Client; connection: GoogleConnection }> {
  const connection = options.platform ? await getPlatformConnection() : await getConnection(userId);
  const actorId = connection?.userId ?? userId;
  if (!connection || connection.status === "revoked") throw new GoogleNotConnectedError(actorId);
  if (connection.status === "needs_reconnect") {
    throw new GoogleReconnectRequiredError(actorId, connection.lastError ?? undefined);
  }

  const client = createOAuthClient();
  const credentials: Credentials = { refresh_token: decrypt(connection.refreshTokenEnc) };
  const expiresAt = connection.accessTokenExpiresAt?.getTime() ?? 0;
  if (connection.accessTokenEnc && expiresAt - Date.now() > 60_000) {
    credentials.access_token = decrypt(connection.accessTokenEnc);
    credentials.expiry_date = expiresAt;
  }
  client.setCredentials(credentials);
  client.on("tokens", (tokens) => {
    void persistTokens(connection.id, tokens);
  });
  return { client, connection };
}

/* ------------------------------------------------------------------ */
/* withGoogle — retry/backoff + reconnect handling                     */
/* ------------------------------------------------------------------ */

const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  const base = 500 * Math.pow(3, attempt); // 500, 1500, 4500
  return Math.min(5_000, base) + Math.floor(Math.random() * 250);
}

export type WithGoogleOptions = {
  /** Skip the lastUsedAt write (health cron). */
  silent?: boolean;
  /** Use the single platform host connection (info@lmsclasses.com). */
  platform?: boolean;
};

/**
 * Runs `fn` with the user's authorized client. Retries 429/5xx/network errors with backoff,
 * force-refreshes once on 401, and marks the connection needs_reconnect on invalid_grant or
 * missing scope. Never logs raw googleapis errors.
 */
export async function withGoogle<T>(
  userId: string,
  fn: (client: OAuth2Client) => Promise<T>,
  options: WithGoogleOptions = {}
): Promise<T> {
  const { client, connection } = await getAuthorizedClient(userId, { platform: options.platform });
  const actorId = connection.userId;
  const reconnectOpts = { platform: options.platform || connection.isPlatformAccount };
  let forcedRefresh = false;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const result = await fn(client);
      if (!options.silent) void touchLastUsed(connection.id);
      return result;
    } catch (err) {
      if (isInvalidGrant(err)) {
        await markNeedsReconnect(actorId, "Google refresh token is no longer valid (invalid_grant).", reconnectOpts);
        throw new GoogleReconnectRequiredError(actorId);
      }
      if (isInsufficientScope(err)) {
        await markNeedsReconnect(actorId, "Google account is missing the Calendar permission.", reconnectOpts);
        throw new GoogleReconnectRequiredError(actorId, "Google account is missing the Calendar permission. Reconnect and allow calendar access.");
      }

      const status = googleErrorStatus(err);

      if (status === 401) {
        if (!forcedRefresh) {
          forcedRefresh = true;
          try {
            client.setCredentials({ refresh_token: client.credentials.refresh_token });
            await client.getAccessToken();
            continue;
          } catch (refreshErr) {
            if (isInvalidGrant(refreshErr)) {
              await markNeedsReconnect(actorId, "Google refresh token is no longer valid (invalid_grant).", reconnectOpts);
            } else {
              await markNeedsReconnect(actorId, "Google rejected the stored credentials.", reconnectOpts);
            }
            throw new GoogleReconnectRequiredError(actorId);
          }
        }
        await markNeedsReconnect(actorId, "Google rejected the stored credentials.", reconnectOpts);
        throw new GoogleReconnectRequiredError(actorId);
      }

      const rateLimited = isRateLimited(err);
      const transient = (status !== null && status >= 500) || isTransientNetworkError(err);
      const lastAttempt = attempt === MAX_ATTEMPTS - 1;

      if ((rateLimited || transient) && !lastAttempt) {
        const retryAfter = googleRetryAfterSeconds(err);
        await sleep(retryAfter ? Math.min(retryAfter * 1000, 10_000) : backoffMs(attempt));
        continue;
      }

      if (rateLimited) {
        throw new GoogleQuotaError("Google Calendar API rate limit exceeded.", googleRetryAfterSeconds(err));
      }

      const scrubbed = scrubGoogleError(err);
      console.error("[google] API call failed", scrubbed);
      throw err;
    }
  }
  // Unreachable, but keeps TypeScript's control-flow analysis happy.
  throw new Error("withGoogle exhausted retries");
}

/* ------------------------------------------------------------------ */
/* Health + disconnect                                                 */
/* ------------------------------------------------------------------ */

/** Forces a token refresh. Returns false (and marks needs_reconnect) when Google rejects the refresh token. */
export async function refreshConnection(userId: string, options: { platform?: boolean } = {}): Promise<boolean> {
  try {
    await withGoogle(
      userId,
      async (client) => {
        client.setCredentials({ refresh_token: client.credentials.refresh_token });
        await client.getAccessToken();
      },
      { silent: true, platform: options.platform }
    );
    return true;
  } catch (err) {
    if (err instanceof GoogleReconnectRequiredError || err instanceof GoogleNotConnectedError) return false;
    console.error("[google] health refresh failed", scrubGoogleError(err));
    return false;
  }
}

/**
 * Revokes the refresh token at Google (best effort) and deletes the local row.
 * Existing calendar events and Meet links are left untouched.
 */
export async function revokeAndDeleteConnection(userId: string): Promise<{ revokedAtGoogle: boolean }> {
  const connection = await getConnection(userId);
  if (!connection) return { revokedAtGoogle: false };

  let revokedAtGoogle = false;
  try {
    const client = createOAuthClient();
    const refreshToken = decrypt(connection.refreshTokenEnc);
    await client.revokeToken(refreshToken);
    revokedAtGoogle = true;
  } catch (err) {
    // Already revoked by the user at myaccount.google.com, key rotated, etc. Still delete locally.
    console.warn("[google] revoke at Google failed (continuing with local delete)", scrubGoogleError(err).message);
  }

  await db
    .delete(googleConnections)
    .where(and(eq(googleConnections.userId, userId), eq(googleConnections.isPlatformAccount, false)));
  return { revokedAtGoogle };
}

export async function revokeAndDeletePlatformConnection(): Promise<{ revokedAtGoogle: boolean }> {
  const connection = await getPlatformConnection();
  if (!connection) return { revokedAtGoogle: false };

  let revokedAtGoogle = false;
  try {
    const client = createOAuthClient();
    const refreshToken = decrypt(connection.refreshTokenEnc);
    await client.revokeToken(refreshToken);
    revokedAtGoogle = true;
  } catch (err) {
    console.warn("[google] revoke platform at Google failed (continuing with local delete)", scrubGoogleError(err).message);
  }

  await db.delete(googleConnections).where(eq(googleConnections.id, connection.id));
  return { revokedAtGoogle };
}

/** Lightweight check used by schedule forms + sync service. */
export async function hasActiveConnection(userId: string): Promise<boolean> {
  const c = await getConnection(userId);
  return !!c && c.status === "active";
}

export function isGmailAddress(email: string | null | undefined): boolean {
  return /@(gmail|googlemail)\.com$/i.test((email ?? "").trim());
}
