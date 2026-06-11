import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { getStudentCourseContent } from "@/lib/content-access";

const courseIdSchema = z.string().uuid();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { error, session } = await requireAuth(["student"]);
  if (error) return error;

  const { courseId } = await params;
  const parsed = courseIdSchema.safeParse(courseId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
  }

  const content = await getStudentCourseContent(session!.user.id, parsed.data);
  if (!content) {
    return NextResponse.json({ error: "Not enrolled in this course" }, { status: 403 });
  }

  return NextResponse.json(content);
}
