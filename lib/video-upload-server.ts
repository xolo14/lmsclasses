import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches } from "@/lib/db/schema";
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
  opts?: { mentorCourseId?: string | null }
) {
  const [batch] = await db
    .select({ name: batches.name, courseId: batches.courseId })
    .from(batches)
    .where(and(eq(batches.id, batchId), isNull(batches.deletedAt)))
    .limit(1);

  if (!batch) {
    throw new VideoUploadAuthError("Batch not found.", 404);
  }
  if (opts?.mentorCourseId && batch.courseId !== opts.mentorCourseId) {
    throw new VideoUploadAuthError("You can only upload to your assigned course.", 403);
  }

  return buildVideoObjectKey(batch.name, filename);
}
