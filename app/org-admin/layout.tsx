import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Script from "next/script";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { OrgAdminSidebar } from "@/components/layout/Sidebar";

export default async function OrgAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "org_admin") {
    redirect("/login");
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <PortalLayout
        sidebar={<OrgAdminSidebar />}
        userName={session.user.name}
        userRole={session.user.role}
      >
        {children}
      </PortalLayout>
    </>
  );
}
