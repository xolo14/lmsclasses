import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { classRecordings, liveClasses } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { readApiJson } from "@/lib/api-url-transport";
import { videoReferenceSchema } from "@/lib/validations/video-reference";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const saveSchema = z.object({
  liveClassId: z.string().uuid(),
  recordingUrl: videoReferenceSchema,
});

/** Attach a GCS object key as the private recording for a live class. */
export async function POST(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager", "mentor"]);
  if (error) return error;

  const parsed = saveSchema.safeParse(await readApiJson(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid recording data" },
      { status: 400 }
    );
  }

  const { liveClassId, recordingUrl } = parsed.data;

  const [existing] = await db
    .select({
      id: liveClasses.id,
      title: liveClasses.title,
      courseId: liveClasses.courseId,
      batchId: liveClasses.batchId,
      mentorId: liveClasses.mentorId,
    })
    .from(liveClasses)
    .where(and(eq(liveClasses.id, liveClassId), isNull(liveClasses.deletedAt)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Live class not found." }, { status: 404 });
  }

  if (session!.user.role === "mentor" && existing.mentorId !== session!.user.id) {
    return NextResponse.json({ error: "You can only save recordings for your own classes." }, { status: 403 });
  }

  try {
    const [updated] = await db
      .update(liveClasses)
      .set({ recordingUrl, status: "completed" })
      .where(eq(liveClasses.id, liveClassId))
      .returning({ id: liveClasses.id, recordingUrl: liveClasses.recordingUrl, status: liveClasses.status });

    if (existing.batchId) {
      try {
        const [copy] = await db
          .select({ id: classRecordings.id })
          .from(classRecordings)
          .where(
            and(
              eq(classRecordings.courseId, existing.courseId),
              eq(classRecordings.batchId, existing.batchId),
              eq(classRecordings.weekName, "Live recording"),
              eq(classRecordings.topicName, existing.title),
              isNull(classRecordings.deletedAt)
            )
          )
          .limit(1);
        if (copy) {
          await db
            .update(classRecordings)
            .set({ videoUrl: recordingUrl, uploadedBy: session!.user.id })
            .where(eq(classRecordings.id, copy.id));
        } else {
          await db.insert(classRecordings).values({
            courseId: existing.courseId,
            batchId: existing.batchId,
            weekName: "Live recording",
            topicName: existing.title,
            videoUrl: recordingUrl,
            uploadedBy: session!.user.id,
          });
        }
      } catch (copyErr) {
        console.error("[save-live] class_recordings copy failed:", copyErr);
      }
    }

    await logAction({
      userId: session!.user.id,
      role: session!.user.role,
      action: "SAVED_LIVE_CLASS_RECORDING",
      entity: "LiveClass",
      entityId: liveClassId,
      metadata: { recordingUrl },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true, liveClass: updated });
  } catch (err) {
    console.error("[save-live]", err);
    return NextResponse.json({ error: "Failed to save the live class recording." }, { status: 500 });
  }
}
