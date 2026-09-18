import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireAuth, resolveOrganisationId } from "@/lib/api-auth";
import { sniffImage } from "@/lib/image-sniff";
import { saveUploadFile } from "@/lib/uploads";

export const runtime = "nodejs";

const MAX_SIZE = 2 * 1024 * 1024;

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

  const bytes = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImage(bytes);
  if (!sniffed) {
    return NextResponse.json({ error: "Only PNG, JPG, WEBP and GIF files are allowed." }, { status: 400 });
  }

  const safeName = `${organisationId}-${Date.now()}-${randomUUID()}.${sniffed.ext}`;
  const { url } = await saveUploadFile("org-logos", safeName, bytes);

  return NextResponse.json({ url });
}
