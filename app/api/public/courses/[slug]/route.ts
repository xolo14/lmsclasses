import { NextResponse } from "next/server";
import { getPublicCourseBySlug } from "@/lib/public-courses";

export const revalidate = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const course = await getPublicCourseBySlug(slug);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    return NextResponse.json(course);
  } catch (err) {
    console.error("[public/courses/slug]", err);
    return NextResponse.json({ error: "Failed to load course" }, { status: 500 });
  }
}
