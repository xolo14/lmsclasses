import { PATCHStudent, DELETEStudent } from "@/lib/api-handlers";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  return PATCHStudent(request, params.id);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  return DELETEStudent(request, params.id);
}
