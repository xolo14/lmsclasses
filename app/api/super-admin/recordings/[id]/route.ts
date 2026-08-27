import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseRecordings } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { courseRecordingUpdateSchema } from "@/lib/validations/course-recording";
import { logAction, getClientIp } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return updateRecording(request, params);
}

/** Hostinger/WAF often blocks PATCH — accept POST for the same update. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return updateRecording(request, params);
}

async function updateRecording(request: Request, params: Promise<{ id: string }>) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = courseRecordingUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid recording data",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const [recording] = await db
      .update(courseRecordings)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(courseRecordings.id, id))
      .returning();

    if (!recording) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    await logAction({
      userId: session!.user.id,
      role: session!.user.role,
      action: "COURSE_RECORDING_UPDATED",
      entity: "CourseRecording",
      entityId: id,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(recording);
  } catch (err) {
    console.error("[super-admin/recordings PATCH/POST]", err);
    return NextResponse.json({ error: "Failed to update recording" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const { id } = await params;
  const [deleted] = await db
    .delete(courseRecordings)
    .where(eq(courseRecordings.id, id))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "COURSE_RECORDING_DELETED",
    entity: "CourseRecording",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}
