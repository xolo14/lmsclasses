import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { StudentSidebar } from "@/components/layout/Sidebar";
import { db } from "@/lib/db";
import { organisations, studentCourses } from "@/lib/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    redirect("/login");
  }

  const [orgSettings, recordEnrollment] = await Promise.all([
    session.user.organisationId
      ? db
          .select({
            logoUrl: organisations.logoUrl,
            jobPortalAccess: organisations.jobPortalAccess,
          })
          .from(organisations)
          .where(eq(organisations.id, session.user.organisationId))
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
  ]);

  return (
    <PortalLayout
      sidebar={
        <StudentSidebar
          brandLogoUrl={orgSettings?.logoUrl}
          jobPortalAccess={orgSettings?.jobPortalAccess ?? true}
          hasRecordCourseEnrollment={!!recordEnrollment}
        />
      }
      userName={session.user.name}
      userRole={session.user.role}
      brandLogoUrl={orgSettings?.logoUrl}
    >
      {children}
    </PortalLayout>
  );
}
