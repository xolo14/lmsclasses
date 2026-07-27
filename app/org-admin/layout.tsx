import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Script from "next/script";
import { eq } from "drizzle-orm";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { OrgAdminSidebar } from "@/components/layout/Sidebar";
import { db } from "@/lib/db";
import { organisations } from "@/lib/db/schema";
import { resolveOrganisationId } from "@/lib/api-auth";

export default async function OrgAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "org_admin") {
    redirect("/login");
  }

  const organisationId = await resolveOrganisationId(session);
  const [org] = organisationId
    ? await db
        .select({ logoUrl: organisations.logoUrl })
        .from(organisations)
        .where(eq(organisations.id, organisationId))
        .limit(1)
    : [null];

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <PortalLayout
        sidebar={<OrgAdminSidebar brandLogoUrl={org?.logoUrl} />}
        userName={session.user.name}
        userRole={session.user.role}
        brandLogoUrl={org?.logoUrl}
      >
        {children}
      </PortalLayout>
    </>
  );
}
