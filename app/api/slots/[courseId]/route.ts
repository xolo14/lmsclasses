import { GETSlots } from "@/lib/api-handlers";
import { requireAuth, resolveOrganisationId } from "@/lib/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { error, session } = await requireAuth(["org_admin"]);
  if (error) return error;
  const { courseId } = await params;

  const organisationId = await resolveOrganisationId(session!);
  if (!organisationId) {
    return Response.json({ error: "Organisation not linked to your account" }, { status: 403 });
  }

  return GETSlots(courseId, organisationId);
}
