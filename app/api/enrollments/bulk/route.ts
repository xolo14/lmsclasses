import { NextResponse } from "next/server";
import { requireAuth, resolveOrganisationId } from "@/lib/api-auth";
import { assignCoursesToStudent } from "@/lib/enrollment-service";
import { bulkAssignSchema } from "@/lib/validations/enrollment";
import { getClientIp } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "org_admin", "manager"]);
  if (error) return error;

  const body = await request.json();
  const parsed = bulkAssignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const orgId =
    session!.user.role === "org_admin"
      ? await resolveOrganisationId(session!)
      : session!.user.organisationId;

  const actor = {
    userId: session!.user.id,
    role: session!.user.role,
    organisationId: orgId,
    ipAddress: getClientIp(request),
  };

  const matrix: {
    studentId: string;
    courseId: string;
    result: "enrolled" | "skipped" | "error";
    message?: string;
  }[] = [];

  for (const studentId of parsed.data.studentIds) {
    for (const courseId of parsed.data.courseIds) {
      const res = await assignCoursesToStudent(
        { studentId, courseIds: [courseId], ...parsed.data.config },
        actor
      );
      if (res.enrolled.length) {
        matrix.push({ studentId, courseId, result: "enrolled" });
      } else if (res.skipped.length) {
        matrix.push({ studentId, courseId, result: "skipped", message: res.skipped[0] });
      } else {
        matrix.push({ studentId, courseId, result: "error", message: res.errors[0] });
      }
    }
  }

  return NextResponse.json({ matrix });
}
