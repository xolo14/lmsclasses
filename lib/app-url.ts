/** Public site URL for emails and links — falls back to auth URL on Hostinger. */
export function getAppUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}
