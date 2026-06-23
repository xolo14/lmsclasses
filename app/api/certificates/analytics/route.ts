import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveOrganisationId } from "@/lib/api-auth";
import { getCertificateAnalytics, type CertActor } from "@/lib/services/certificate-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "super_admin" && session.user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const actor: CertActor = {
    userId: session.user.id,
    role: session.user.role,
    name: session.user.name ?? "Admin",
    organisationId:
      session.user.role === "org_admin"
        ? await resolveOrganisationId(session)
        : session.user.organisationId ?? null,
  };
  const data = await getCertificateAnalytics(actor);
  return NextResponse.json(data);
}
