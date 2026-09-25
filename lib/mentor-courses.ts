import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { liveCourses, mentorCourses, users } from "@/lib/db/schema";

export function uniqueCourseIds(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const value = typeof id === "string" ? id.trim() : "";
    if (!value || value === "none" || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function parseMentorCourseIds(input: {
  courseId?: string | null;
  courseIds?: string[] | null;
}): string[] {
  if (Array.isArray(input.courseIds) && input.courseIds.length) {
    return uniqueCourseIds(input.courseIds);
  }
  return uniqueCourseIds([input.courseId]);
}

export async function getMentorCourseIds(mentorId: string): Promise<string[]> {
  const rows = await db
    .select({ courseId: mentorCourses.courseId })
    .from(mentorCourses)
    .where(eq(mentorCourses.mentorId, mentorId));
  if (rows.length) return uniqueCourseIds(rows.map((row) => row.courseId));

  const [mentor] = await db
    .select({ courseId: users.courseId })
    .from(users)
    .where(eq(users.id, mentorId))
    .limit(1);
  return uniqueCourseIds([mentor?.courseId]);
}

export async function mentorHasCourseAccess(mentorId: string, courseId: string): Promise<boolean> {
  const ids = await getMentorCourseIds(mentorId);
  return ids.includes(courseId);
}

export async function replaceMentorCourses(mentorId: string, courseIds: string[]) {
  const ids = uniqueCourseIds(courseIds);
  await db.delete(mentorCourses).where(eq(mentorCourses.mentorId, mentorId));
  if (ids.length) {
    await db.insert(mentorCourses).values(ids.map((courseId) => ({ mentorId, courseId })));
  }
  await db
    .update(users)
    .set({ courseId: ids[0] ?? null, updatedAt: new Date() })
    .where(eq(users.id, mentorId));
}

export async function assertLiveCoursesExist(courseIds: string[]): Promise<string | null> {
  const ids = uniqueCourseIds(courseIds);
  if (!ids.length) return null;
  const rows = await db
    .select({ id: liveCourses.id })
    .from(liveCourses)
    .where(and(inArray(liveCourses.id, ids), isNull(liveCourses.deletedAt)));
  if (rows.length !== ids.length) return "One or more live courses were not found.";
  return null;
}
