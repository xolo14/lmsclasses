import { GETSuperAdminHrDetail } from "@/lib/api-hr";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return GETSuperAdminHrDetail(id);
}
