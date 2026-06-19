import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerLeads, studentCourses, users } from "@/lib/db/schema";
import { requireApiKey, finishApiKeyRequest } from "@/lib/api-key-auth";
import { resolveCourseByName } from "@/lib/partner-course-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "/api/external/check-student";

export async function GET(request: Request) {
  const auth = await requireApiKey(request, "check_student_exists", ENDPOINT);
  if (auth.error) return auth.error;
  const ctx = auth.context!;

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    const course = searchParams.get("course");

    if (!email) {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        NextResponse.json(
          { error: "VALIDATION_FAILED", message: "email query param required" },
          { status: 422 }
        )
      );
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    let enrolled = false;
    if (user && course) {
      const resolved = await resolveCourseByName(course);
      if (resolved) {
        const [enrollment] = await db
          .select({ id: studentCourses.id })
          .from(studentCourses)
          .where(
            and(
              eq(studentCourses.studentId, user.id),
              eq(studentCourses.recordCourseId, resolved.id),
              eq(studentCourses.isActive, true)
            )
          )
          .limit(1);
        enrolled = !!enrollment;
      }
    }

    const [lead] = course
      ? await db
          .select({ id: partnerLeads.id })
          .from(partnerLeads)
          .where(and(eq(partnerLeads.email, email), eq(partnerLeads.course, course)))
          .limit(1)
      : [null];

    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      NextResponse.json({
        exists: !!user,
        enrolled,
        hasLead: !!lead,
        leadId: lead?.id ?? null,
      })
    );
  } catch (err) {
    console.error("[external/check-student] GET:", err);
    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      NextResponse.json({ error: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    );
  }
}
