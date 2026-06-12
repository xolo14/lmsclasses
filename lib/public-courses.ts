import { db } from "@/lib/db";
import { recordCourses, studentCourses, courseRecordings } from "@/lib/db/schema";
import { resolveCourseThumbnailUrl } from "@/lib/course-thumbnail";
import { backfillMissingRecordCourseSlugs } from "@/lib/slug";
import { and, eq, isNull, sql, desc, count } from "drizzle-orm";

export type PublicCourseListItem = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price: string;
  duration: string | null;
  thumbnailUrl: string | null;
  level: string | null;
  language: string | null;
  totalHours: number | null;
  totalLectures: number | null;
  certificate: boolean | null;
  isFeatured: boolean | null;
  demoVideoUrl: string | null;
};

function mapDemoUrl(course: { demoVideoUrl: string | null; demoUrl: string | null }) {
  return course.demoVideoUrl || course.demoUrl || null;
}

export async function getPublicCourses(): Promise<PublicCourseListItem[]> {
  await backfillMissingRecordCourseSlugs();

  const rows = await db
    .select({
      id: recordCourses.id,
      title: recordCourses.title,
      slug: recordCourses.slug,
      description: recordCourses.description,
      price: recordCourses.price,
      duration: recordCourses.duration,
      thumbnailUrl: recordCourses.thumbnailUrl,
      level: recordCourses.level,
      language: recordCourses.language,
      totalHours: recordCourses.totalHours,
      totalLectures: recordCourses.totalLectures,
      certificate: recordCourses.certificate,
      isFeatured: recordCourses.isFeatured,
      demoVideoUrl: recordCourses.demoVideoUrl,
      demoUrl: recordCourses.demoUrl,
    })
    .from(recordCourses)
    .where(and(eq(recordCourses.isActive, true), isNull(recordCourses.deletedAt)))
    .orderBy(desc(recordCourses.createdAt));

  return rows.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug!,
      description: c.description,
      price: c.price,
      duration: c.duration,
      thumbnailUrl: resolveCourseThumbnailUrl(c.thumbnailUrl, mapDemoUrl(c)),
      level: c.level,
      language: c.language,
      totalHours: c.totalHours,
      totalLectures: c.totalLectures,
      certificate: c.certificate,
      isFeatured: c.isFeatured,
      demoVideoUrl: mapDemoUrl(c),
    }));
}

export async function getPublicCourseBySlug(slug: string) {
  const [course] = await db
    .select({
      id: recordCourses.id,
      title: recordCourses.title,
      slug: recordCourses.slug,
      description: recordCourses.description,
      price: recordCourses.price,
      duration: recordCourses.duration,
      thumbnailUrl: recordCourses.thumbnailUrl,
      level: recordCourses.level,
      language: recordCourses.language,
      totalHours: recordCourses.totalHours,
      totalLectures: recordCourses.totalLectures,
      certificate: recordCourses.certificate,
      isFeatured: recordCourses.isFeatured,
      demoVideoUrl: recordCourses.demoVideoUrl,
      demoUrl: recordCourses.demoUrl,
      syllabus: recordCourses.syllabus,
      whatYouLearn: recordCourses.whatYouLearn,
      requirements: recordCourses.requirements,
      updatedAt: recordCourses.updatedAt,
    })
    .from(recordCourses)
    .where(and(eq(recordCourses.slug, slug), eq(recordCourses.isActive, true), isNull(recordCourses.deletedAt)))
    .limit(1);

  if (!course) return null;

  const [[enrollmentRow], [recordingRow]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentCourses)
      .where(and(eq(studentCourses.recordCourseId, course.id), eq(studentCourses.isActive, true))),
    db
      .select({ count: count() })
      .from(courseRecordings)
      .where(eq(courseRecordings.recordCourseId, course.id)),
  ]);

  const syllabus = (course.syllabus as { week?: number; title?: string; topics?: string[] }[] | null) ?? [];
  const whatYouLearn = (course.whatYouLearn as string[] | null) ?? [];
  const requirements = (course.requirements as string[] | null) ?? [];

  return {
    id: course.id,
    title: course.title,
    slug: course.slug!,
    description: course.description,
    price: course.price,
    duration: course.duration,
    thumbnailUrl: resolveCourseThumbnailUrl(course.thumbnailUrl, mapDemoUrl(course)),
    level: course.level,
    language: course.language,
    totalHours: course.totalHours,
    totalLectures: course.totalLectures,
    certificate: course.certificate,
    isFeatured: course.isFeatured,
    demoVideoUrl: mapDemoUrl(course),
    syllabus,
    whatYouLearn,
    requirements,
    updatedAt: course.updatedAt,
    enrolledCount: enrollmentRow?.count ?? 0,
    recordingsCount: recordingRow?.count ?? 0,
    liveClasses: [] as { id: string; title: string; scheduledAt: string | Date | null; status: string }[], // Record courses do not have live classes
  };
}
