import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classRecordings } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { classRecordingSchema } from "@/lib/validations";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  try {
    const body = await request.json();
    const { courseId, batchId, recordings } = body;

    if (!courseId || !batchId || !Array.isArray(recordings)) {
      return NextResponse.json(
        { error: "courseId, batchId, and recordings array are required" },
        { status: 400 }
      );
    }

    const parsedRecordings: any[] = [];
    
    // Validate all items first
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

    // Single batch insert query (atomic in PostgreSQL)
    const insertedRecordings = await db
      .insert(classRecordings)
      .values(parsedRecordings)
      .returning();

    // Log audit logs after successful insertion
    for (const recording of insertedRecordings) {
      try {
        await logAction({
          userId: session!.user.id,
          role: session!.user.role,
          action: "CREATED_CLASS_RECORDING",
          entity: "ClassRecording",
          entityId: recording.id,
          metadata: { weekName: recording.weekName, topicName: recording.topicName, importMode: "bulk" },
          ipAddress: getClientIp(request),
        });
      } catch (auditErr) {
        console.error(`[POSTBulkClassRecordings] Audit logging failed for recording ${recording.id}:`, auditErr);
      }
    }

    return NextResponse.json({
      success: true,
      successCount: insertedRecordings.length,
      recordings: insertedRecordings,
    }, { status: 201 });

  } catch (err) {
    console.error("[POSTBulkClassRecordings] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to bulk create class recordings";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
