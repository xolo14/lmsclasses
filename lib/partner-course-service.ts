import { and, eq, isNull, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches, liveCourses, recordCourses } from "@/lib/db/schema";
import { getAppUrl } from "@/lib/app-url";
import { resolveCourseThumbnailUrl } from "@/lib/course-thumbnail";
import type { ApiKey } from "@/lib/db/schema";
import { courseAllowed } from "@/lib/api-key-service";

export type PublicCourseItem = {
  name: string;
  slug: string;
  price: number;
  currency: string;
  level: string | null;
  language: string | null;
  thumbnail: string | null;
};

export async function resolveCourseByName(courseName: string) {
  const trimmed = courseName.trim();
  const [byTitle] = await db
    .select({
      id: recordCourses.id,
      title: recordCourses.title,
      slug: recordCourses.slug,
      price: recordCourses.price,
      level: recordCourses.level,
      language: recordCourses.language,
      thumbnailUrl: recordCourses.thumbnailUrl,
      demoVideoUrl: recordCourses.demoVideoUrl,
      demoUrl: recordCourses.demoUrl,
    })
    .from(recordCourses)
    .where(
      and(
        eq(recordCourses.isActive, true),
        isNull(recordCourses.deletedAt),
        ilike(recordCourses.title, trimmed)
      )
    )
    .limit(1);
  if (byTitle?.slug) {
    return {
      id: byTitle.id,
      title: byTitle.title,
      slug: byTitle.slug,
      price: parseFloat(byTitle.price),
      level: byTitle.level,
      language: byTitle.language,
      thumbnail: resolveCourseThumbnailUrl(
        byTitle.thumbnailUrl,
        byTitle.demoVideoUrl || byTitle.demoUrl
      ),
    };
  }

  const slugCandidate = trimmed.toLowerCase().replace(/\s+/g, "-");
  const [bySlug] = await db
    .select({
      id: recordCourses.id,
      title: recordCourses.title,
      slug: recordCourses.slug,
      price: recordCourses.price,
      level: recordCourses.level,
      language: recordCourses.language,
      thumbnailUrl: recordCourses.thumbnailUrl,
      demoVideoUrl: recordCourses.demoVideoUrl,
      demoUrl: recordCourses.demoUrl,
    })
    .from(recordCourses)
    .where(
      and(
        eq(recordCourses.isActive, true),
        isNull(recordCourses.deletedAt),
        eq(recordCourses.slug, slugCandidate)
      )
    )
    .limit(1);
  if (bySlug?.slug) {
    return {
      id: bySlug.id,
      title: bySlug.title,
      slug: bySlug.slug,
      price: parseFloat(bySlug.price),
      level: bySlug.level,
      language: bySlug.language,
      thumbnail: resolveCourseThumbnailUrl(
        bySlug.thumbnailUrl,
        bySlug.demoVideoUrl || bySlug.demoUrl
      ),
    };
  }
  return null;
}

export async function getCoursesForApiKey(apiKey: ApiKey): Promise<PublicCourseItem[]> {
  const rows = await db
    .select({
      title: recordCourses.title,
      slug: recordCourses.slug,
      price: recordCourses.price,
      level: recordCourses.level,
      language: recordCourses.language,
      thumbnailUrl: recordCourses.thumbnailUrl,
      demoVideoUrl: recordCourses.demoVideoUrl,
      demoUrl: recordCourses.demoUrl,
    })
    .from(recordCourses)
    .where(and(eq(recordCourses.isActive, true), isNull(recordCourses.deletedAt)));

  const appUrl = getAppUrl();
  return rows
    .filter((c) => c.slug && courseAllowed(apiKey, c.title))
    .map((c) => ({
      name: c.title,
      slug: c.slug!,
      price: parseFloat(c.price),
      currency: "INR",
      level: c.level,
      language: c.language,
      thumbnail: resolveCourseThumbnailUrl(c.thumbnailUrl, c.demoVideoUrl || c.demoUrl)
        ? `${appUrl}${resolveCourseThumbnailUrl(c.thumbnailUrl, c.demoVideoUrl || c.demoUrl)}`
        : null,
    }));
}

export async function getBatchScheduleForApiKey(apiKey: ApiKey) {
  const liveRows = await db
    .select({
      courseTitle: liveCourses.title,
      batchName: batches.name,
      startDate: batches.startDate,
      maxSlots: batches.maxSlots,
    })
    .from(batches)
    .innerJoin(liveCourses, eq(batches.courseId, liveCourses.id))
    .where(and(isNull(batches.deletedAt), eq(liveCourses.isActive, true), isNull(liveCourses.deletedAt)));

  return liveRows
    .filter((b) => courseAllowed(apiKey, b.courseTitle))
    .map((b) => ({
      course: b.courseTitle,
      batchName: b.batchName,
      startDate: b.startDate ? b.startDate.toISOString().slice(0, 10) : null,
      seatsAvailable: b.maxSlots ?? null,
    }));
}
