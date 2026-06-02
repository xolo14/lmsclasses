import { GETTrash, POSTTrashRestore } from "@/lib/api-trash-recordings";

export async function GET() {
  return GETTrash();
}

export async function POST(request: Request) {
  return POSTTrashRestore(request);
}
