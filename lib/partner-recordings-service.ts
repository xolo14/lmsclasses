import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseRecordings, recordCourses, type ApiKey } from "@/lib/db/schema";
import { resolveAllowedCourseIds } from "@/lib/api-key-service";
import {
  PARTNER_SIGNED_URL_TTL_MS,
  toPlayableVideoUrl,
} from "@/lib/gcs";

export type PartnerRecordingCourse = {
  courseId: string;
  courseTitle: string;
  recordings: {
    id: string;
    title: string;
    description: string | null;
    videoUrl: string;
    /** Present when videoUrl is a short-lived GCS signed URL. */
    videoUrlExpiresAt?: string;
    durationMinutes: number | null;
    sortOrder: number;
  }[];
};

/**
 * All published course recordings for the record courses on this API key.
 * Optional courseId narrows to one allowed course.
 * Private GCS object keys/URLs are replaced with V4 signed read URLs.
 */
export async function getRecordingsForApiKey(
  apiKey: ApiKey,
  filterCourseId?: string | null
): Promise<PartnerRecordingCourse[]> {
  let courseIds = resolveAllowedCourseIds(apiKey);
  if (filterCourseId) {
    if (!courseIds.includes(filterCourseId)) {
      return [];
    }
    courseIds = [filterCourseId];
  }
  if (courseIds.length === 0) return [];

  const courses = await db
    .select({
      id: recordCourses.id,
      title: recordCourses.title,
    })
    .from(recordCourses)
    .where(
      and(
        inArray(recordCourses.id, courseIds),
        eq(recordCourses.isActive, true),
        isNull(recordCourses.deletedAt)
      )
    )
    .orderBy(asc(recordCourses.title));

  if (courses.length === 0) return [];

  const rows = await db
    .select({
      id: courseRecordings.id,
      recordCourseId: courseRecordings.recordCourseId,
      title: courseRecordings.title,
      description: courseRecordings.description,
      videoUrl: courseRecordings.videoUrl,
      duration: courseRecordings.duration,
      sortOrder: courseRecordings.sortOrder,
    })
    .from(courseRecordings)
    .where(
      and(
        inArray(
          courseRecordings.recordCourseId,
          courses.map((c) => c.id)
        ),
        eq(courseRecordings.isPublished, true)
      )
    )
    .orderBy(asc(courseRecordings.sortOrder), asc(courseRecordings.title));

  const expiresAt = new Date(Date.now() + PARTNER_SIGNED_URL_TTL_MS).toISOString();

  const playableById = new Map<string, { url: string; signed: boolean }>();
  await Promise.all(
    rows.map(async (r) => {
      const stored = r.videoUrl;
      const url = await toPlayableVideoUrl(stored, PARTNER_SIGNED_URL_TTL_MS);
      playableById.set(r.id, { url, signed: url !== stored.trim() });
    })
  );

  return courses.map((course) => ({
    courseId: course.id,
    courseTitle: course.title,
    recordings: rows
      .filter((r) => r.recordCourseId === course.id)
      .map((r) => {
        const playable = playableById.get(r.id)!;
        return {
          id: r.id,
          title: r.title,
          description: r.description,
          videoUrl: playable.url,
          ...(playable.signed ? { videoUrlExpiresAt: expiresAt } : {}),
          durationMinutes: r.duration,
          sortOrder: r.sortOrder,
        };
      }),
  }));
}
