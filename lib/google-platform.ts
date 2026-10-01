import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";

export const DEFAULT_PLATFORM_GOOGLE_EMAIL = "info@lmsclasses.com";
export const SYSTEM_KEY_DEFAULT_MEET_MODE = "live_class_default_meet_mode";

export type DefaultMeetMode = "google_platform" | "google_host";

export function getPlatformGoogleEmail(): string {
  return (process.env.PLATFORM_GOOGLE_EMAIL?.trim() || DEFAULT_PLATFORM_GOOGLE_EMAIL).toLowerCase();
}

export function isPlatformGoogleEmail(email: string | null | undefined): boolean {
  const value = (email ?? "").trim().toLowerCase();
  return !!value && value === getPlatformGoogleEmail();
}

export async function getDefaultMeetMode(): Promise<DefaultMeetMode> {
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, SYSTEM_KEY_DEFAULT_MEET_MODE))
    .limit(1);
  return row?.value === "google_host" ? "google_host" : "google_platform";
}

export async function setDefaultMeetMode(mode: DefaultMeetMode): Promise<void> {
  const now = new Date();
  await db
    .insert(systemSettings)
    .values({ key: SYSTEM_KEY_DEFAULT_MEET_MODE, value: mode, updatedAt: now })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value: mode, updatedAt: now } });
}
