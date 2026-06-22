/** Public site URL for emails and links — falls back to auth URL on Hostinger. */
export function getAppUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
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
