import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { sniffImage } from "@/lib/image-sniff";
import { saveUploadFile } from "@/lib/uploads";
import {
  CERTIFICATE_BACKGROUND_MAX_BYTES,
  CERTIFICATE_BACKGROUND_MAX_LABEL,
} from "@/lib/upload-limits";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_SIZE = CERTIFICATE_BACKGROUND_MAX_BYTES;

export async function POST(request: Request) {
  try {
    const { error } = await requireAuth(["super_admin", "org_admin"]);
    if (error) return error;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required." }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `Image size must be between 1 byte and ${CERTIFICATE_BACKGROUND_MAX_LABEL}.` },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffImage(bytes);
    if (!sniffed) {
      return NextResponse.json({ error: "Only PNG, JPG, WEBP and GIF files are allowed." }, { status: 400 });
    }

    const safeName = `bg-${Date.now()}-${randomUUID()}.${sniffed.ext}`;
    const { url } = await saveUploadFile("certificate-backgrounds", safeName, bytes);

    return NextResponse.json({ url });
  } catch (e) {
    console.error("[certificate-background upload]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
