import { PATCHCourse, DELETECourse } from "@/lib/api-handlers";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  return PATCHCourse(request, params.id);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  return DELETECourse(request, params.id);
}
