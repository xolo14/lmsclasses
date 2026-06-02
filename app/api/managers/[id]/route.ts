import { PATCHUser, DELETEUser } from "@/lib/api-handlers";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  return PATCHUser(request, params.id);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  return DELETEUser(request, params.id);
}
