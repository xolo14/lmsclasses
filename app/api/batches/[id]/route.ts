import { PATCHBatch, DELETEBatch } from "@/lib/api-handlers";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  return PATCHBatch(request, params.id);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  return DELETEBatch(request, params.id);
}
