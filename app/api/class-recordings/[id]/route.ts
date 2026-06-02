import { PATCHClassRecording, DELETEClassRecording } from "@/lib/api-trash-recordings";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  return PATCHClassRecording(request, params.id);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  return DELETEClassRecording(request, params.id);
}
