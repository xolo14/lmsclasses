import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches, classRecordings } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { classRecordingSchema } from "@/lib/validations";
import { readApiJson } from "@/lib/api-url-transport";

export const runtime = "nodejs";

const MAX_BULK_RECORDINGS = 500;

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  try {
    const body = ((await readApiJson(request)) ?? {}) as {
      courseId?: unknown;
      batchId?: unknown;
      recordings?: unknown;
    };
    const { courseId, batchId, recordings } = body;

    if (typeof courseId !== "string" || typeof batchId !== "string" || !Array.isArray(recordings)) {
      return NextResponse.json(
        { error: "courseId, batchId, and recordings array are required" },
        { status: 400 }
      );
    }

    if (recordings.length > MAX_BULK_RECORDINGS) {
      return NextResponse.json(
        { error: `Import is limited to ${MAX_BULK_RECORDINGS} recordings at a time.` },
        { status: 400 }
      );
    }

    const [batch] = await db
      .select({ id: batches.id })
      .from(batches)
      .where(and(eq(batches.id, batchId), eq(batches.courseId, courseId), isNull(batches.deletedAt)))
      .limit(1);
    if (!batch) {
      return NextResponse.json({ error: "Batch does not belong to this course." }, { status: 400 });
    }

    const parsedRecordings: Record<string, unknown>[] = [];

    for (let i = 0; i < recordings.length; i++) {
      const item = recordings[i];
      const parsed = classRecordingSchema.safeParse({
        ...item,
        courseId,
        batchId,
      });

      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        const formatted = Object.entries(fieldErrors)
          .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
          .join("; ");
        return NextResponse.json({ error: `Row ${i + 1}: ${formatted}` }, { status: 400 });
      }

      parsedRecordings.push({
        ...parsed.data,
        uploadedBy: session!.user.id,
      });
    }

    const insertedRecordings = await db
      .insert(classRecordings)
      .values(parsedRecordings as typeof classRecordings.$inferInsert[])
      .returning();

    try {
      await logAction({
        userId: session!.user.id,
        role: session!.user.role,
        action: "BULK_CREATED_CLASS_RECORDINGS",
        entity: "ClassRecording",
        entityId: insertedRecordings[0]?.id,
        metadata: { count: insertedRecordings.length, courseId, batchId },
        ipAddress: getClientIp(request),
      });
    } catch (auditErr) {
      console.error("[POSTBulkClassRecordings] Audit logging failed:", auditErr);
    }

    return NextResponse.json({
      success: true,
      successCount: insertedRecordings.length,
      recordings: insertedRecordings,
    }, { status: 201 });
  } catch (err) {
    console.error("[POSTBulkClassRecordings] error:", err);
    return NextResponse.json({ error: "Failed to bulk create class recordings" }, { status: 400 });
  }
}
