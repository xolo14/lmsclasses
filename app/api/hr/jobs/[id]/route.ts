import { DELETEHrJob, GETHrJobById, PATCHHrJob } from "@/lib/api-hr";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return GETHrJobById(_request, id);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return PATCHHrJob(request, id);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return DELETEHrJob(request, id);
}
