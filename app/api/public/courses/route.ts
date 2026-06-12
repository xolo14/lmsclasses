import { NextResponse } from "next/server";
import { getPublicCourses } from "@/lib/public-courses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const courses = await getPublicCourses();
    return NextResponse.json(courses);
  } catch (err) {
    console.error("[public/courses]", err);
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
  }
}
