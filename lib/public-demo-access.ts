import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { liveCourses, recordCourses } from "@/lib/db/schema";
import { parseGcsObjectKey } from "@/lib/gcs";

function mapDemo(demoVideoUrl: string | null, demoUrl: string | null) {
  return (demoVideoUrl || demoUrl || "").trim();
}

function demoRefsMatch(stored: string, requested: string): boolean {
  const a = stored.trim();
  const b = requested.trim();
  if (!a || !b) return false;
  if (a === b) return true;

  const keyA = parseGcsObjectKey(a);
  const keyB = parseGcsObjectKey(b);
  if (keyA && keyB && keyA === keyB) return true;
  if (keyA && keyA === b) return true;
  if (keyB && keyB === a) return true;
  return false;
}

/**
 * True when `videoKey` matches an active course's public demo field.
 * Used so anonymous visitors can play marketing demos stored as private GCS keys.
 */
export async function isPublicCourseDemoReference(videoKey: string): Promise<boolean> {
  const requested = videoKey.trim();
  if (!requested) return false;

  const [liveRows, recordRows] = await Promise.all([
    db
      .select({
        demoUrl: liveCourses.demoUrl,
        demoVideoUrl: liveCourses.demoVideoUrl,
      })
      .from(liveCourses)
      .where(and(eq(liveCourses.isActive, true), isNull(liveCourses.deletedAt))),
    db
      .select({
        demoUrl: recordCourses.demoUrl,
        demoVideoUrl: recordCourses.demoVideoUrl,
      })
      .from(recordCourses)
      .where(and(eq(recordCourses.isActive, true), isNull(recordCourses.deletedAt))),
  ]);

  for (const row of [...liveRows, ...recordRows]) {
    const stored = mapDemo(row.demoVideoUrl, row.demoUrl);
    if (stored && demoRefsMatch(stored, requested)) return true;
  }
  return false;
}
