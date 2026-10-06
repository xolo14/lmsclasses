/** Public site URL for emails and links — falls back to auth URL on Hostinger. */
export function getAppUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}

/** Website Google login callback. Hostinger WAF 403s `/api/auth/callback/google`. */
export function googleSignInCallbackUrl(): string {
  return `${getAppUrl()}/api/google/signin`;
}

/** Origin for 302s. Never use request.url alone — on Hostinger it can be invalid and 500. */
export function publicOrigin(request: Request): string {
  const env = (
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
  if (env) {
    try {
      return new URL(env).origin;
    } catch {
      /* fall through */
    }
  }

  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(",")[0]
    .trim();
  const proto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  if (host) return `${proto}://${host}`;

  try {
    return new URL(request.url).origin;
  } catch {
    return "https://lmsclasses.com";
  }
}

export function publicUrl(request: Request, path: string): URL {
  const origin = publicOrigin(request);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, `${origin}/`);
}

/** Resolve API-key redirect paths (relative or absolute) to a full URL. */
export function resolveRedirectUrl(
  pathOrUrl: string | null | undefined,
  fallback = "/login"
): string {
  const raw = (pathOrUrl ?? fallback).trim();
  if (!raw) return `${getAppUrl()}${fallback.startsWith("/") ? fallback : `/${fallback}`}`;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${getAppUrl()}${path}`;
}
