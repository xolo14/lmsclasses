import { GETOrganisationSecondaryAdmins, POSTOrganisationSecondaryAdmin } from "@/lib/api-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return GETOrganisationSecondaryAdmins(id);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return POSTOrganisationSecondaryAdmin(request, id);
}
