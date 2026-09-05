import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { liveCourses, recordCourses, studentCourses } from "@/lib/db/schema";

export type PublicDemoCourse = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  price: string;
  demoUrl: string;
  isActive: boolean;
  courseType: "live" | "record";
  enrolledCount: number;
};

function mapDemoUrl(demoVideoUrl: string | null, demoUrl: string | null) {
  return (demoVideoUrl || demoUrl || "").trim();
}

/** Active or shared course with a demo video — live or record — for public share links. */
export async function getPublicDemoCourseById(id: string): Promise<PublicDemoCourse | null> {
  const [live] = await db
    .select({
      id: liveCourses.id,
      title: liveCourses.title,
      slug: liveCourses.slug,
      description: liveCourses.description,
      price: liveCourses.price,
      demoUrl: liveCourses.demoUrl,
      demoVideoUrl: liveCourses.demoVideoUrl,
      isActive: liveCourses.isActive,
    })
    .from(liveCourses)
    .where(and(eq(liveCourses.id, id), isNull(liveCourses.deletedAt)))
    .limit(1);

  if (live) {
    const demoUrl = mapDemoUrl(live.demoVideoUrl, live.demoUrl);
    if (!demoUrl) return null;

    const [enrollmentRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentCourses)
      .where(and(eq(studentCourses.liveCourseId, live.id), eq(studentCourses.isActive, true)));

    return {
      id: live.id,
      title: live.title,
      slug: live.slug,
      description: live.description,
      price: live.price,
      demoUrl,
      isActive: !!live.isActive,
      courseType: "live",
      enrolledCount: enrollmentRow?.count ?? 0,
    };
  }

  const [record] = await db
    .select({
      id: recordCourses.id,
      title: recordCourses.title,
      slug: recordCourses.slug,
      description: recordCourses.description,
      price: recordCourses.price,
      demoUrl: recordCourses.demoUrl,
      demoVideoUrl: recordCourses.demoVideoUrl,
      isActive: recordCourses.isActive,
    })
    .from(recordCourses)
    .where(and(eq(recordCourses.id, id), isNull(recordCourses.deletedAt)))
    .limit(1);

  if (!record) return null;

  const demoUrl = mapDemoUrl(record.demoVideoUrl, record.demoUrl);
  if (!demoUrl) return null;

  const [enrollmentRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(studentCourses)
    .where(and(eq(studentCourses.recordCourseId, record.id), eq(studentCourses.isActive, true)));

  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    description: record.description,
    price: record.price,
    demoUrl,
    isActive: !!record.isActive,
    courseType: "record",
    enrolledCount: enrollmentRow?.count ?? 0,
  };
}

export async function listPublicDemoCourseIds(): Promise<string[]> {
  const [liveRows, recordRows] = await Promise.all([
    db
      .select({ id: liveCourses.id, demoUrl: liveCourses.demoUrl, demoVideoUrl: liveCourses.demoVideoUrl })
      .from(liveCourses)
      .where(isNull(liveCourses.deletedAt)),
    db
      .select({
        id: recordCourses.id,
        demoUrl: recordCourses.demoUrl,
        demoVideoUrl: recordCourses.demoVideoUrl,
      })
      .from(recordCourses)
      .where(isNull(recordCourses.deletedAt)),
  ]);

  return [...liveRows, ...recordRows]
    .filter((c) => mapDemoUrl(c.demoVideoUrl, c.demoUrl))
    .map((c) => c.id);
}
