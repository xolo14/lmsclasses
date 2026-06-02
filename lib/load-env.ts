/**
 * CLI-only helpers for drizzle-kit and seed scripts.
 * Do not import this from app code (middleware/auth run on Edge).
 */
import { config } from "dotenv";
import { resolve } from "path";

const PLACEHOLDER_PATTERN = /user:pass@host/;

export function validateDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL is missing. Add it to .env.local (copy from .env.example)."
    );
    process.exit(1);
  }

  if (PLACEHOLDER_PATTERN.test(url)) {
    console.error(
      "DATABASE_URL is still the placeholder in .env.local.\n" +
        "Create a free database at https://neon.tech, copy the connection string, and set DATABASE_URL in .env.local.\n" +
        "Then run: npm run db:push && npm run seed"
    );
    process.exit(1);
  }

  return url;
}

/** Loads .env.local — Node.js CLI only (uses process.cwd). */
export function loadEnvLocal(): string {
  config({ path: resolve(process.cwd(), ".env.local") });
  return validateDatabaseUrl();
}
