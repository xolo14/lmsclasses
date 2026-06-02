import { GETSuperAdminJobPostingDetail } from "@/lib/api-hr";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  return GETSuperAdminJobPostingDetail(params.id);
}

