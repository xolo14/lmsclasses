import { NextResponse } from "next/server";
import { GETStudentCourses } from "@/lib/api-handlers";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { error, session } = await requireAuth(["student"]);
  if (error) return error;

  return GETStudentCourses(session!.user.id);
}
