import { db } from "@/lib/db";
import { courses, studentCourses, liveClasses, classRecordings } from "@/lib/db/schema";
import { and, eq, isNull, sql, desc, gte, count } from "drizzle-orm";

export type PublicCourseListItem = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price: string;
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
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      price: courses.price,
      thumbnailUrl: courses.thumbnailUrl,
      level: courses.level,
      language: courses.language,
      totalHours: courses.totalHours,
      totalLectures: courses.totalLectures,
      certificate: courses.certificate,
      isFeatured: courses.isFeatured,
      demoVideoUrl: courses.demoVideoUrl,
      demoUrl: courses.demoUrl,
    })
    .from(courses)
    .where(and(eq(courses.isActive, true), isNull(courses.deletedAt), eq(courses.courseType, "record")))
    .orderBy(desc(courses.createdAt));

  return rows
    .filter((c) => c.slug)
    .map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug!,
      description: c.description,
      price: c.price,
      thumbnailUrl: c.thumbnailUrl,
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
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      price: courses.price,
      thumbnailUrl: courses.thumbnailUrl,
      level: courses.level,
      language: courses.language,
      totalHours: courses.totalHours,
      totalLectures: courses.totalLectures,
      certificate: courses.certificate,
      isFeatured: courses.isFeatured,
      demoVideoUrl: courses.demoVideoUrl,
      demoUrl: courses.demoUrl,
      syllabus: courses.syllabus,
      whatYouLearn: courses.whatYouLearn,
      requirements: courses.requirements,
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .where(and(eq(courses.slug, slug), eq(courses.isActive, true), isNull(courses.deletedAt), eq(courses.courseType, "record")))
    .limit(1);

  if (!course) return null;

  const [[enrollmentRow], upcomingClasses, [recordingRow]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentCourses)
      .where(and(eq(studentCourses.courseId, course.id), eq(studentCourses.isActive, true))),
    db
      .select({
        title: liveClasses.title,
        scheduledAt: liveClasses.scheduledAt,
        status: liveClasses.status,
      })
      .from(liveClasses)
      .where(
        and(
          eq(liveClasses.courseId, course.id),
          isNull(liveClasses.deletedAt),
          gte(liveClasses.scheduledAt, new Date())
        )
      )
      .orderBy(liveClasses.scheduledAt)
      .limit(5),
    db
      .select({ count: count() })
      .from(classRecordings)
      .where(and(eq(classRecordings.courseId, course.id), isNull(classRecordings.deletedAt))),
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
    thumbnailUrl: course.thumbnailUrl,
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
    liveClasses: upcomingClasses.map((lc) => ({
      title: lc.title,
      scheduledAt: lc.scheduledAt,
      status: lc.status,
    })),
  };
}
