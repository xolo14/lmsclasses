import { PATCHRecordCourse, DELETERecordCourse } from "@/lib/api-handlers";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { recordCourses } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const [course] = await db
    .select({
      id: recordCourses.id,
      title: recordCourses.title,
      description: recordCourses.description,
      price: recordCourses.price,
      demoUrl: recordCourses.demoUrl,
      demoVideoUrl: recordCourses.demoVideoUrl,
      isActive: recordCourses.isActive,
    })
    .from(recordCourses)
    .where(and(eq(recordCourses.id, id), isNull(recordCourses.deletedAt)))
    .limit(1);

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  return NextResponse.json(course);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return PATCHRecordCourse(request, id);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return DELETERecordCourse(request, id);
}
