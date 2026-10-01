import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { publicUrl } from "@/lib/app-url";
import { getClientIp, logAction } from "@/lib/audit";
import {
  createOAuthClient,
  getConnectionByGoogleSub,
  isGoogleConfigured,
  parseScopeString,
  requiredScopes,
  scopesGranted,
  upsertConnection,
  upsertPlatformConnection,
  verifyGoogleIdToken,
} from "@/lib/services/googleAuth";
import { GOOGLE_NONCE_COOKIE, verifyState } from "@/lib/services/googleState";
import { scrubGoogleError } from "@/lib/services/googleErrors";
import { sanitizeReturnTo } from "@/lib/actions/googleIntegration";
import { getPlatformGoogleEmail, isPlatformGoogleEmail } from "@/lib/google-platform";
import { retryPendingForHost, retryPendingForPlatform } from "@/lib/services/liveClassGoogleSync";
import { integrationsPathForRole } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function finish(request: Request, path: string, code: string): NextResponse {
  const joiner = path.includes("?") ? "&" : "?";
  const response = NextResponse.redirect(publicUrl(request, `${path}${joiner}google=${code}`), 302);
  response.cookies.set({ name: GOOGLE_NONCE_COOKIE, value: "", path: "/api/google/callback", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * GET /api/google/callback?code=…&state=…  (or ?error=access_denied)
 * Verifies state + nonce + user binding, exchanges the code, checks id_token and granted scopes,
 * rejects a Google account already linked to another LMS user, then stores encrypted tokens.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(publicUrl(request, "/login"), 302);
  }
  const user = session.user;
  const fallbackPath = integrationsPathForRole(user.role);
  const url = new URL(request.url);

  if (!isGoogleConfigured()) return finish(request, fallbackPath, "not_configured");

  const cookieStore = await cookies();
  const nonceCookie = cookieStore.get(GOOGLE_NONCE_COOKIE)?.value;
  const verified = verifyState(url.searchParams.get("state"), user.id, nonceCookie);
  if (!verified.ok) {
    console.warn("[google] callback state rejected", verified.reason);
    return finish(request, fallbackPath, "state");
  }
  const returnTo = sanitizeReturnTo(verified.state.returnTo, user.role);

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return finish(request, returnTo, oauthError === "access_denied" ? "denied" : "error");
  }
  const code = url.searchParams.get("code");
  if (!code) return finish(request, returnTo, "error");

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      // Google only returns a refresh token on consent; prompt=consent should prevent this.
      return finish(request, returnTo, "no_refresh");
    }
    if (!tokens.id_token) return finish(request, returnTo, "error");

    const identity = await verifyGoogleIdToken(tokens.id_token);
    const granted = parseScopeString(tokens.scope);
    if (!scopesGranted(granted, requiredScopes())) {
      try {
        await client.revokeToken(tokens.refresh_token);
      } catch {
        /* best effort */
      }
      return finish(request, returnTo, "scope");
    }

    const isPlatform = verified.state.platform === true;
    if (isPlatform) {
      if (user.role !== "super_admin") return finish(request, returnTo, "denied");
      if (!identity.emailVerified || !isPlatformGoogleEmail(identity.email)) {
        try {
          await client.revokeToken(tokens.refresh_token);
        } catch {
          /* best effort */
        }
        return finish(request, returnTo, "wrong_account");
      }
    } else if (isPlatformGoogleEmail(identity.email)) {
      try {
        await client.revokeToken(tokens.refresh_token);
      } catch {
        /* best effort */
      }
      return finish(request, returnTo, "reserved");
    }

    const existing = await getConnectionByGoogleSub(identity.sub);
    if (existing && existing.userId !== user.id && !(isPlatform && existing.isPlatformAccount)) {
      return finish(request, returnTo, "in_use");
    }
    if (existing && isPlatform && !existing.isPlatformAccount && existing.userId !== user.id) {
      return finish(request, returnTo, "in_use");
    }
    if (existing && !isPlatform && existing.isPlatformAccount) {
      return finish(request, returnTo, "in_use");
    }

    const tokenInput = {
      userId: user.id,
      googleEmail: identity.email,
      googleSub: identity.sub,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token ?? null,
      accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: granted,
    };

    if (isPlatform) {
      await upsertPlatformConnection(tokenInput);
      void logAction({
        userId: user.id,
        role: user.role,
        action: "google.platform_connected",
        entity: "google_connection",
        entityId: user.id,
        metadata: { googleEmail: getPlatformGoogleEmail(), scopes: granted },
        ipAddress: getClientIp(request),
      });
      void retryPendingForPlatform()
        .then((n) => n > 0 && console.log(`[google] created ${n} pending platform Meet link(s)`))
        .catch((err) => console.error("[google] retryPendingForPlatform failed", err instanceof Error ? err.message : err));
      return finish(request, returnTo, "platform_connected");
    }

    await upsertConnection(tokenInput);

    void logAction({
      userId: user.id,
      role: user.role,
      action: "google.connected",
      entity: "google_connection",
      entityId: user.id,
      metadata: { googleEmail: identity.email, scopes: granted },
      ipAddress: getClientIp(request),
    });

    // Classes that were saved while this host was disconnected get their Meet link now.
    void retryPendingForHost(user.id)
      .then((n) => n > 0 && console.log(`[google] created ${n} pending Meet link(s) for ${user.id}`))
      .catch((err) => console.error("[google] retryPendingForHost failed", err instanceof Error ? err.message : err));

    return finish(request, returnTo, "connected");
  } catch (err) {
    console.error("[google] callback failed", scrubGoogleError(err));
    return finish(request, returnTo, "error");
  }
}
