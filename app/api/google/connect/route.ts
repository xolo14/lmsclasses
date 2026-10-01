import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { publicUrl } from "@/lib/app-url";
import { checkRateLimit } from "@/lib/rate-limit";
import { createOAuthClient, isGoogleConfigured, requestedScopes } from "@/lib/services/googleAuth";
import { GOOGLE_NONCE_COOKIE, newNonce, signState, STATE_TTL_MS } from "@/lib/services/googleState";
import { sanitizeReturnTo } from "@/lib/actions/googleIntegration";
import { getPlatformGoogleEmail } from "@/lib/google-platform";
import { GOOGLE_HOST_ROLES } from "@/lib/utils";
import type { Role } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/google/connect?returnTo=/mentor/settings/integrations
 * Starts the per-user Google OAuth flow. Plain GET so the UI can use a link (WAF-safe).
 */
export async function GET(request: Request) {
  const { error, session } = await requireAuth([...GOOGLE_HOST_ROLES] as Role[]);
  if (error) return error;
  const user = session!.user;

  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"), user.role);
  const platform = url.searchParams.get("platform") === "1" || url.searchParams.get("platform") === "true";

  if (platform && user.role !== "super_admin") {
    return NextResponse.redirect(publicUrl(request, `${returnTo}?google=denied`), 302);
  }

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(publicUrl(request, `${returnTo}?google=not_configured`), 302);
  }

  const limit = checkRateLimit(`google:connect:${user.id}`, 10, 10 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.redirect(publicUrl(request, `${returnTo}?google=rate_limited`), 302);
  }

  const nonce = newNonce();
  const state = signState({ uid: user.id, nonce, returnTo, platform: platform || undefined });

  const client = createOAuthClient();
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    // Always ask for consent so Google returns a refresh token on every connect/reconnect.
    prompt: "consent",
    include_granted_scopes: true,
    scope: requestedScopes(),
    state,
    login_hint: platform ? getPlatformGoogleEmail() : user.email ?? undefined,
  });

  const response = NextResponse.redirect(authUrl, 302);
  response.cookies.set({
    name: GOOGLE_NONCE_COOKIE,
    value: nonce,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google/callback",
    maxAge: Math.floor(STATE_TTL_MS / 1000),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
