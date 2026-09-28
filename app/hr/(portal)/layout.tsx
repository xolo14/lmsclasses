import { auth } from "@/lib/auth";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { HrSidebar } from "@/components/layout/Sidebar";
import { requirePortalSession } from "@/lib/require-portal";

export default async function HrPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  requirePortalSession(session, "hr");

  return (
    <PortalLayout
      sidebar={<HrSidebar />}
      userName={session.user.name}
      userRole={session.user.role}
    >
      {children}
    </PortalLayout>
  );
}
