import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { studentCourses, users, liveCourses, recordCourses, organisations } from "@/lib/db/schema";
import { requireAuth, resolveOrganisationId } from "@/lib/api-auth";
import { updateEnrollment } from "@/lib/enrollment-service";
import { updateEnrollmentSchema } from "@/lib/validations/enrollment";
import { getClientIp } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(["super_admin", "org_admin", "manager"]);
  if (error) return error;
  const { id } = await params;

  const actorOrgId =
    session!.user.role === "org_admin" ? await resolveOrganisationId(session!) : null;
  if (session!.user.role === "org_admin" && !actorOrgId) {
    return NextResponse.json({ error: "Organisation not found for admin" }, { status: 403 });
  }

  const where =
    session!.user.role === "org_admin"
      ? and(eq(studentCourses.id, id), eq(studentCourses.organisationId, actorOrgId!))
      : eq(studentCourses.id, id);

  const [row] = await db
    .select({
      enrollment: studentCourses,
      studentName: users.name,
      studentEmail: users.email,
      orgName: organisations.name,
      liveTitle: liveCourses.title,
      recordTitle: recordCourses.title,
    })
    .from(studentCourses)
    .innerJoin(users, eq(studentCourses.studentId, users.id))
    .leftJoin(organisations, eq(studentCourses.organisationId, organisations.id))
    .leftJoin(liveCourses, eq(studentCourses.liveCourseId, liveCourses.id))
    .leftJoin(recordCourses, eq(studentCourses.recordCourseId, recordCourses.id))
    .where(where)
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...row.enrollment,
    studentName: row.studentName,
    studentEmail: row.studentEmail,
    orgName: row.orgName,
    courseTitle: row.liveTitle ?? row.recordTitle,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(["super_admin", "org_admin", "manager"]);
  if (error) return error;
  const { id } = await params;

  const body = await request.json();
  const parsed = updateEnrollmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  let orgId =
    session!.user.role === "org_admin" ? await resolveOrganisationId(session!) : session!.user.organisationId;
  if (session!.user.role === "org_admin" && !orgId) {
    return NextResponse.json({ error: "Organisation not found for admin" }, { status: 403 });
  }

  const result = await updateEnrollment(id, parsed.data, {
    userId: session!.user.id,
    role: session!.user.role,
    organisationId: orgId,
    ipAddress: getClientIp(request),
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(["super_admin", "org_admin", "manager"]);
  if (error) return error;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason : "Revoked by admin";

  let orgId =
    session!.user.role === "org_admin" ? await resolveOrganisationId(session!) : session!.user.organisationId;
  if (session!.user.role === "org_admin" && !orgId) {
    return NextResponse.json({ error: "Organisation not found for admin" }, { status: 403 });
  }

  const result = await updateEnrollment(
    id,
    { status: "revoked", revokeReason: reason },
    {
      userId: session!.user.id,
      role: session!.user.role,
      organisationId: orgId,
      ipAddress: getClientIp(request),
    }
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
