import { encode } from "next-auth/jwt";
import { authConfig, useSecureCookies } from "@/lib/auth.config";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export function getSessionCookieName(): string {
  return useSecureCookies ? "__Secure-authjs.session-token" : "authjs.session-token";
}

export async function createSessionToken(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  lmsId?: string | null;
}) {
  const cookieName = getSessionCookieName();
  return encode({
    token: {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organisationId: null,
      lmsId: user.lmsId ?? null,
    },
    secret: authConfig.secret!,
    salt: cookieName,
    maxAge: SESSION_MAX_AGE,
  });
}

export async function buildSessionSetCookieHeader(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  lmsId?: string | null;
}): Promise<string> {
  const token = await createSessionToken(user);
  const cookieName = getSessionCookieName();
  const secure = useSecureCookies ? "; Secure" : "";
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`;
}
