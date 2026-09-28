import { auth } from "@/lib/auth";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { SuperAdminSidebar } from "@/components/layout/Sidebar";
import { requirePortalSession } from "@/lib/require-portal";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  requirePortalSession(session, "super_admin");

  return (
    <PortalLayout
      sidebar={<SuperAdminSidebar />}
      userName={session.user.name}
      userRole={session.user.role}
    >
      {children}
    </PortalLayout>
  );
}
