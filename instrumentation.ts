/**
 * Runs once when the Next.js server starts (Hostinger `next start`).
 * Loads env fallback before any route handles requests.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadHostingerEnv } = await import("./lib/hostinger-env");
    loadHostingerEnv();
  }
}
