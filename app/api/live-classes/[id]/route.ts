import { PATCHLiveClass, DELETELiveClass } from "@/lib/api-handlers";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  return PATCHLiveClass(request, params.id);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  return DELETELiveClass(request, params.id);
}
