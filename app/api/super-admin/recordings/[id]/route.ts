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
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = courseRecordingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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
