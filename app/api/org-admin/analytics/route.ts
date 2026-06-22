import { NextResponse } from "next/server";
import { requireAuth, resolveOrganisationId } from "@/lib/api-auth";
import { getOrgAdminAnalytics } from "@/lib/org-admin-analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error, session } = await requireAuth(["org_admin"]);
  if (error) return error;

  const organisationId = await resolveOrganisationId(session!);
  if (!organisationId) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }

  const analytics = await getOrgAdminAnalytics(organisationId, session!.user.id);
  return NextResponse.json(analytics);
}
