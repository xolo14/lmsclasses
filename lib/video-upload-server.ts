import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches, liveClasses } from "@/lib/db/schema";
import { buildVideoObjectKey } from "@/lib/video-upload";

export class VideoUploadAuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/** Look up the batch name and derive the `{batch}/{timestamp}_{file}` object key. */
export async function resolveBatchVideoObjectKey(
  batchId: string,
  filename: string,
  opts?: { mentorCourseId?: string | null; mentorCourseIds?: string[] }
) {
  const [batch] = await db
    .select({ name: batches.name, courseId: batches.courseId })
    .from(batches)
    .where(and(eq(batches.id, batchId), isNull(batches.deletedAt)))
    .limit(1);

  if (!batch) {
    throw new VideoUploadAuthError("Batch not found.", 404);
  }
  const allowed = opts?.mentorCourseIds ?? (opts?.mentorCourseId ? [opts.mentorCourseId] : []);
  if (allowed.length && (!batch.courseId || !allowed.includes(batch.courseId))) {
    throw new VideoUploadAuthError("You can only upload to your assigned course.", 403);
  }

  return buildVideoObjectKey(batch.name, filename);
}

/** Folder from the live class batch (or title) — mentors may only record their own class. */
export async function resolveLiveClassVideoObjectKey(
  liveClassId: string,
  filename: string,
  opts?: { mentorUserId?: string; mentorCourseId?: string | null; mentorCourseIds?: string[] }
) {
  const [row] = await db
    .select({
      id: liveClasses.id,
      title: liveClasses.title,
      mentorId: liveClasses.mentorId,
      courseId: liveClasses.courseId,
      batchName: batches.name,
    })
    .from(liveClasses)
    .leftJoin(batches, eq(liveClasses.batchId, batches.id))
    .where(and(eq(liveClasses.id, liveClassId), isNull(liveClasses.deletedAt)))
    .limit(1);

  if (!row) {
    throw new VideoUploadAuthError("Live class not found.", 404);
  }
  if (opts?.mentorUserId && row.mentorId !== opts.mentorUserId) {
    throw new VideoUploadAuthError("You can only record your own live classes.", 403);
  }
  const allowed = opts?.mentorCourseIds ?? (opts?.mentorCourseId ? [opts.mentorCourseId] : []);
  if (allowed.length && (!row.courseId || !allowed.includes(row.courseId))) {
    throw new VideoUploadAuthError("You can only record classes for your assigned course.", 403);
  }

  return buildVideoObjectKey(row.batchName || row.title || "live-class", filename);
}
