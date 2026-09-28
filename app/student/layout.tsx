import { auth } from "@/lib/auth";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { StudentSidebar } from "@/components/layout/Sidebar";
import { db } from "@/lib/db";
import { organisations, studentCourses, users } from "@/lib/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { requirePortalSession } from "@/lib/require-portal";

/** Prefer DB user.org, then an active enrollment's org (JWT organisationId is often stale/null). */
async function resolveStudentOrganisationId(studentId: string): Promise<string | null> {
  const [studentRow] = await db
    .select({ organisationId: users.organisationId })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);

  if (studentRow?.organisationId) return studentRow.organisationId;

  const [enrollmentOrg] = await db
    .select({ organisationId: studentCourses.organisationId })
    .from(studentCourses)
    .where(
      and(
        eq(studentCourses.studentId, studentId),
        eq(studentCourses.isActive, true),
        isNotNull(studentCourses.organisationId)
      )
    )
    .orderBy(desc(studentCourses.enrolledAt))
    .limit(1);

  return enrollmentOrg?.organisationId ?? null;
}

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  requirePortalSession(session, "student");

  const organisationId = await resolveStudentOrganisationId(session.user.id);

  const [orgSettings, recordEnrollment, liveBatchEnrollment] = await Promise.all([
    organisationId
      ? db
          .select({
            logoUrl: organisations.logoUrl,
            jobPortalAccess: organisations.jobPortalAccess,
          })
          .from(organisations)
          .where(eq(organisations.id, organisationId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    db
      .select({ id: studentCourses.id })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.studentId, session.user.id),
          eq(studentCourses.isActive, true),
          isNotNull(studentCourses.recordCourseId)
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ id: studentCourses.id })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.studentId, session.user.id),
          eq(studentCourses.isActive, true),
          isNotNull(studentCourses.liveCourseId),
          isNotNull(studentCourses.batchId)
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const brandLogoUrl = orgSettings?.logoUrl?.trim() || null;

  return (
    <PortalLayout
      sidebar={
        <StudentSidebar
          brandLogoUrl={brandLogoUrl}
          jobPortalAccess={orgSettings?.jobPortalAccess ?? true}
          hasRecordCourseEnrollment={!!recordEnrollment || !!liveBatchEnrollment}
        />
      }
      userName={session.user.name}
      userRole={session.user.role}
      brandLogoUrl={brandLogoUrl}
    >
      {children}
    </PortalLayout>
  );
}
