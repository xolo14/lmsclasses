import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "";
}

export async function POST(request: Request) {
  const { error } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Image size must be between 1 byte and 5MB." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only PNG, JPG, WEBP and GIF files are allowed." }, { status: 400 });
  }

  const ext = extensionFor(file.type);
  const safeName = `${Date.now()}-${randomUUID()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "course-thumbnails");
  await mkdir(uploadDir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, safeName), bytes);

  return NextResponse.json({ url: `/uploads/course-thumbnails/${safeName}` });
}
