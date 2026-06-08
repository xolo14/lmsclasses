import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { StudentSidebar } from "@/components/layout/Sidebar";
import { db } from "@/lib/db";
import { organisations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    redirect("/login");
  }

  const orgSettings = session.user.organisationId
    ? (
        await db
          .select({ logoUrl: organisations.logoUrl, jobPortalAccess: organisations.jobPortalAccess })
          .from(organisations)
          .where(eq(organisations.id, session.user.organisationId))
          .limit(1)
      )[0] ?? null
    : null;

  return (
    <PortalLayout
      sidebar={
        <StudentSidebar
          brandLogoUrl={orgSettings?.logoUrl}
          jobPortalAccess={orgSettings?.jobPortalAccess ?? true}
        />
      }
      userName={session.user.name}
      userRole={session.user.role}
    >
      {children}
    </PortalLayout>
  );
}
