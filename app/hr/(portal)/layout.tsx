import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { HrSidebar } from "@/components/layout/Sidebar";

export default async function HrPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "hr") {
    redirect("/hr/login");
  }

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
