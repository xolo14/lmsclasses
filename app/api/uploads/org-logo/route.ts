import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireAuth, resolveOrganisationId } from "@/lib/api-auth";
import { saveUploadFile } from "@/lib/uploads";

export const runtime = "nodejs";

const MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "";
}

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["org_admin"]);
  if (error) return error;

  const organisationId = await resolveOrganisationId(session!);
  if (!organisationId) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Image size must be between 1 byte and 2MB." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only PNG, JPG, WEBP and GIF files are allowed." }, { status: 400 });
  }

  const ext = extensionFor(file.type);
  const safeName = `${organisationId}-${Date.now()}-${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { url } = await saveUploadFile("org-logos", safeName, bytes);

  return NextResponse.json({ url });
}
