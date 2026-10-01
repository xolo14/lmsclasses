import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getGoogleEnv } from "@/lib/services/googleAuth";

/**
 * Signed OAuth `state` for /api/google/connect → /api/google/callback.
 * Binds the flow to the LMS user, a one-time nonce cookie and a vetted returnTo path.
 */

export const GOOGLE_NONCE_COOKIE = "lms_google_oauth_nonce";
export const STATE_TTL_MS = 10 * 60 * 1000;

export type GoogleOAuthState = {
  uid: string;
  nonce: string;
  returnTo: string;
  iat: number;
  /** Super Admin connecting the LMS-wide host (info@lmsclasses.com). */
  platform?: boolean;
};

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  const { stateSecret } = getGoogleEnv();
  return createHmac("sha256", stateSecret).update(payload).digest("base64url");
}

export function newNonce(): string {
  return randomBytes(24).toString("hex");
}

export function signState(state: Omit<GoogleOAuthState, "iat">): string {
  const full: GoogleOAuthState = { ...state, iat: Date.now() };
  const payload = b64url(JSON.stringify(full));
  return `${payload}.${sign(payload)}`;
}

export type VerifyStateResult = { ok: true; state: GoogleOAuthState } | { ok: false; reason: string };

export function verifyState(raw: string | null | undefined, expectedUserId: string, nonceCookie: string | undefined): VerifyStateResult {
  if (!raw || !raw.includes(".")) return { ok: false, reason: "missing_state" };
  const dot = raw.lastIndexOf(".");
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!payload || !sig) return { ok: false, reason: "malformed_state" };

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return { ok: false, reason: "not_configured" };
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };

  let state: GoogleOAuthState;
  try {
    state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GoogleOAuthState;
  } catch {
    return { ok: false, reason: "malformed_state" };
  }
  if (!state || typeof state.uid !== "string" || typeof state.nonce !== "string" || typeof state.iat !== "number") {
    return { ok: false, reason: "malformed_state" };
  }
  if (Date.now() - state.iat > STATE_TTL_MS) return { ok: false, reason: "expired" };
  if (state.uid !== expectedUserId) return { ok: false, reason: "user_mismatch" };
  if (!nonceCookie) return { ok: false, reason: "missing_nonce" };
  const n1 = Buffer.from(nonceCookie);
  const n2 = Buffer.from(state.nonce);
  if (n1.length !== n2.length || !timingSafeEqual(n1, n2)) return { ok: false, reason: "nonce_mismatch" };
  return { ok: true, state };
}
