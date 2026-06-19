import { GETOrgAdminPurchasedRecordCourses } from "@/lib/api-handlers";
import { requireAuth, resolveOrganisationId } from "@/lib/api-auth";

export async function GET() {
  const { error, session } = await requireAuth(["org_admin"]);
  if (error) return error;

  const organisationId = await resolveOrganisationId(session!);
  if (!organisationId) {
    return Response.json({ error: "Organisation not linked to your account" }, { status: 403 });
  }

  return GETOrgAdminPurchasedRecordCourses(organisationId);
}
