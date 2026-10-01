import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { organisations, systemSettings } from "@/lib/db/schema";

/**
 * Whether to send the branded LMS "class scheduled" email on top of Google's own invite.
 * Org students → organisations.lms_live_class_email_*; direct (no-org) enrollments → system_settings.
 */

export type LiveClassEmailPrefs = {
  emailMentor: boolean;
  emailStudents: boolean;
};

export const DEFAULT_LIVE_CLASS_EMAIL_PREFS: LiveClassEmailPrefs = {
  emailMentor: true,
  emailStudents: false,
};

const SYSTEM_KEY_MENTOR = "live_class_email_mentor";
const SYSTEM_KEY_STUDENTS = "live_class_email_students";

function parseBool(value: string | null | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return fallback;
}

export async function getSystemLiveClassEmailPrefs(): Promise<LiveClassEmailPrefs> {
  const rows = await db
    .select()
    .from(systemSettings)
    .where(inArray(systemSettings.key, [SYSTEM_KEY_MENTOR, SYSTEM_KEY_STUDENTS]));
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    emailMentor: parseBool(map.get(SYSTEM_KEY_MENTOR), DEFAULT_LIVE_CLASS_EMAIL_PREFS.emailMentor),
    emailStudents: parseBool(map.get(SYSTEM_KEY_STUDENTS), DEFAULT_LIVE_CLASS_EMAIL_PREFS.emailStudents),
  };
}

export async function setSystemLiveClassEmailPrefs(prefs: Partial<LiveClassEmailPrefs>): Promise<void> {
  const now = new Date();
  const entries: Array<[string, boolean | undefined]> = [
    [SYSTEM_KEY_MENTOR, prefs.emailMentor],
    [SYSTEM_KEY_STUDENTS, prefs.emailStudents],
  ];
  for (const [key, value] of entries) {
    if (typeof value !== "boolean") continue;
    await db
      .insert(systemSettings)
      .values({ key, value: String(value), updatedAt: now })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: String(value), updatedAt: now } });
  }
}

export async function getOrgLiveClassEmailPrefs(organisationId: string): Promise<LiveClassEmailPrefs> {
  const [row] = await db
    .select({
      emailMentor: organisations.lmsLiveClassEmailMentor,
      emailStudents: organisations.lmsLiveClassEmailStudents,
    })
    .from(organisations)
    .where(eq(organisations.id, organisationId))
    .limit(1);
  if (!row) return DEFAULT_LIVE_CLASS_EMAIL_PREFS;
  return {
    emailMentor: row.emailMentor ?? DEFAULT_LIVE_CLASS_EMAIL_PREFS.emailMentor,
    emailStudents: row.emailStudents ?? DEFAULT_LIVE_CLASS_EMAIL_PREFS.emailStudents,
  };
}

export async function setOrgLiveClassEmailPrefs(organisationId: string, prefs: Partial<LiveClassEmailPrefs>): Promise<void> {
  const set: Partial<typeof organisations.$inferInsert> = { updatedAt: new Date() };
  if (typeof prefs.emailMentor === "boolean") set.lmsLiveClassEmailMentor = prefs.emailMentor;
  if (typeof prefs.emailStudents === "boolean") set.lmsLiveClassEmailStudents = prefs.emailStudents;
  await db.update(organisations).set(set).where(eq(organisations.id, organisationId));
}

/** Resolve prefs for a given student/mentor context. `organisationId` null → system defaults. */
export async function getLiveClassEmailPrefs(organisationId: string | null | undefined): Promise<LiveClassEmailPrefs> {
  if (organisationId) return getOrgLiveClassEmailPrefs(organisationId);
  return getSystemLiveClassEmailPrefs();
}
