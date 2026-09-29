import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { classRecordings, liveClasses } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { readApiJson } from "@/lib/api-url-transport";
import { videoReferenceSchema } from "@/lib/validations/video-reference";
import {
  liveRecordingColumn,
  liveRecordingDisplayTitle,
  liveRecordingSlotTitle,
  liveRecordingSlotsFromRow,
  type LiveRecordingSlot,
} from "@/lib/live-recording-slots";
import { liveRecordingSlotColumnsMissing, withLiveRecordingSlotColumns } from "@/lib/live-recording-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const saveSchema = z.object({
  liveClassId: z.string().uuid(),
  recordingUrl: videoReferenceSchema,
  slot: z.enum(["A", "B", "C"]).optional().default("A"),
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

  const { liveClassId, recordingUrl, slot } = parsed.data;
  const recordingSlot = slot as LiveRecordingSlot;
  const column = liveRecordingColumn(recordingSlot);

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
      .set(
        recordingSlot === "A"
          ? { recordingUrl, status: "completed" }
          : { [column]: recordingUrl, status: "completed" }
      )
      .where(eq(liveClasses.id, liveClassId))
      .returning({ id: liveClasses.id, recordingUrl: liveClasses.recordingUrl, status: liveClasses.status });

    const slotRows = await withLiveRecordingSlotColumns(
      () =>
        db
          .select({
            recordingUrl: liveClasses.recordingUrl,
            recordingUrlB: liveClasses.recordingUrlB,
            recordingUrlC: liveClasses.recordingUrlC,
          })
          .from(liveClasses)
          .where(eq(liveClasses.id, liveClassId))
          .limit(1),
      async () => {
        const rows = await db
          .select({ recordingUrl: liveClasses.recordingUrl })
          .from(liveClasses)
          .where(eq(liveClasses.id, liveClassId))
          .limit(1);
        return rows.map((row) => ({ ...row, recordingUrlB: null, recordingUrlC: null }));
      }
    );
    const nextRow = {
      recordingUrl: recordingSlot === "A" ? recordingUrl : slotRows[0]?.recordingUrl ?? null,
      recordingUrlB: recordingSlot === "B" ? recordingUrl : slotRows[0]?.recordingUrlB ?? null,
      recordingUrlC: recordingSlot === "C" ? recordingUrl : slotRows[0]?.recordingUrlC ?? null,
    };
    const slotCount = liveRecordingSlotsFromRow(nextRow).length;
    const topicName = liveRecordingDisplayTitle(existing.title, recordingSlot, slotCount);

    if (existing.batchId) {
      try {
        const copyWhere = and(
          eq(classRecordings.courseId, existing.courseId),
          eq(classRecordings.batchId, existing.batchId),
          eq(classRecordings.weekName, "Live recording"),
          isNull(classRecordings.deletedAt)
        );
        if (slotCount > 1) {
          const [plainA] = await db
            .select({ id: classRecordings.id })
            .from(classRecordings)
            .where(and(copyWhere, eq(classRecordings.topicName, existing.title)))
            .limit(1);
          if (plainA) {
            await db
              .update(classRecordings)
              .set({ topicName: liveRecordingSlotTitle(existing.title, "A") })
              .where(eq(classRecordings.id, plainA.id));
          }
        }
        const [copy] = await db
          .select({ id: classRecordings.id })
          .from(classRecordings)
          .where(
            and(
              copyWhere,
              eq(
                classRecordings.topicName,
                slotCount > 1 ? liveRecordingSlotTitle(existing.title, recordingSlot) : existing.title
              )
            )
          )
          .limit(1);
        const [legacy] =
          !copy && recordingSlot === "A"
            ? await db
                .select({ id: classRecordings.id })
                .from(classRecordings)
                .where(
                  and(
                    copyWhere,
                    eq(
                      classRecordings.topicName,
                      slotCount > 1 ? existing.title : liveRecordingSlotTitle(existing.title, "A")
                    )
                  )
                )
                .limit(1)
            : [undefined];
        const targetId = copy?.id ?? legacy?.id;
        if (targetId) {
          await db
            .update(classRecordings)
            .set({ videoUrl: recordingUrl, topicName, uploadedBy: session!.user.id })
            .where(eq(classRecordings.id, targetId));
        } else {
          await db.insert(classRecordings).values({
            courseId: existing.courseId,
            batchId: existing.batchId,
            weekName: "Live recording",
            topicName,
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
      metadata: { recordingUrl, slot: recordingSlot },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true, liveClass: updated });
  } catch (err) {
    if (recordingSlot !== "A" && liveRecordingSlotColumnsMissing(err)) {
      return NextResponse.json(
        { error: "Recording slots B and C are not in the database yet. Run npm run db:push." },
        { status: 503 }
      );
    }
    console.error("[save-live]", err);
    return NextResponse.json({ error: "Failed to save the live class recording." }, { status: 500 });
  }
}
