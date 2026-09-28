import { auth } from "@/lib/auth";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { MentorSidebar } from "@/components/layout/Sidebar";
import { requirePortalSession } from "@/lib/require-portal";

export default async function MentorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  requirePortalSession(session, "mentor");

  return (
    <PortalLayout
      sidebar={<MentorSidebar />}
      userName={session.user.name}
      userRole={session.user.role}
    >
      {children}
    </PortalLayout>
  );
}
