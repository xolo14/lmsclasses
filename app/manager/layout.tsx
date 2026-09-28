import { auth } from "@/lib/auth";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { ManagerSidebar } from "@/components/layout/Sidebar";
import { requirePortalSession } from "@/lib/require-portal";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  requirePortalSession(session, "manager");

  return (
    <PortalLayout
      sidebar={<ManagerSidebar />}
      userName={session.user.name}
      userRole={session.user.role}
    >
      {children}
    </PortalLayout>
  );
}
