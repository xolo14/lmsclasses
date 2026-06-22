import { eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import type { ApiKey } from "@/lib/db/schema";
import { getAppUrl } from "@/lib/app-url";

const token = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 4);

export function slugifyApiKeyName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return base || "enroll";
}

export async function generateUniqueFormSlug(name: string): Promise<string> {
  const base = slugifyApiKeyName(name);
  for (let i = 0; i < 12; i++) {
    const candidate = `${base}-${token()}`;
    const [existing] = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(eq(apiKeys.formSlug, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  throw new Error("Failed to generate unique form link token");
}

export function buildFormLink(formSlug: string): string {
  const base = getAppUrl().replace(/\/$/, "");
  return `${base}/enroll/${formSlug}`;
}

/** Backfill formSlug for keys created before hosted forms existed. */
export async function ensureFormSlug(apiKey: ApiKey): Promise<string> {
  if (apiKey.formSlug) return apiKey.formSlug;
  const formSlug = await generateUniqueFormSlug(apiKey.name);
  await db
    .update(apiKeys)
    .set({ formSlug, updatedAt: new Date() })
    .where(eq(apiKeys.id, apiKey.id));
  return formSlug;
}
