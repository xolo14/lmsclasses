import { GETTrash, POSTTrashRestore, DELETETrashClear } from "@/lib/api-trash-recordings";

export async function GET() {
  return GETTrash();
}

export async function POST(request: Request) {
  return POSTTrashRestore(request);
}

export async function DELETE(request: Request) {
  return DELETETrashClear(request);
}
