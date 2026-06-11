import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseRecordings, courses } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { courseRecordingSchema } from "@/lib/validations/course-recording";
import { logAction, getClientIp } from "@/lib/audit";

export async function GET(request: Request) {
  const { error } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const courseId = new URL(request.url).searchParams.get("courseId");
  if (!courseId) {
    return NextResponse.json({ error: "courseId query param required" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: courseRecordings.id,
      courseId: courseRecordings.courseId,
      title: courseRecordings.title,
      description: courseRecordings.description,
      videoUrl: courseRecordings.videoUrl,
      duration: courseRecordings.duration,
      sortOrder: courseRecordings.sortOrder,
      isPublished: courseRecordings.isPublished,
      createdAt: courseRecordings.createdAt,
    })
    .from(courseRecordings)
    .where(eq(courseRecordings.courseId, courseId))
    .orderBy(asc(courseRecordings.sortOrder));

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = courseRecordingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, parsed.data.courseId))
      .limit(1);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const [recording] = await db
      .insert(courseRecordings)
      .values({
        ...parsed.data,
        createdBy: session!.user.id,
      })
      .returning();

    await logAction({
      userId: session!.user.id,
      role: session!.user.role,
      action: "COURSE_RECORDING_CREATED",
      entity: "CourseRecording",
      entityId: recording.id,
      metadata: { courseId: parsed.data.courseId, title: parsed.data.title },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(recording, { status: 201 });
  } catch (err) {
    console.error("[super-admin/recordings POST]", err);
    return NextResponse.json({ error: "Failed to create recording" }, { status: 500 });
  }
}
