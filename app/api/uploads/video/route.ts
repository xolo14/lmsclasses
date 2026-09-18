import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { batches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStorage, getBucketName } from "@/lib/gcs";
import { getVideoSizeError } from "@/lib/video-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Legacy server-proxied upload. The whole file is buffered through Node, so in
 * practice it is capped by the Next.js/hosting body limit (~62 MB) — the
 * recording modal uses /api/uploads/video-resumable for multi-GB files.
 */
export async function POST(request: Request) {
  const { error } = await requireAuth(["super_admin", "manager", "mentor"]);
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const batchId = formData.get("batchId");

    if (!(file instanceof File) || !batchId) {
      return NextResponse.json(
        { error: "File and batchId are required." },
        { status: 400 }
      );
    }

    const sizeError = getVideoSizeError(file.size);
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 413 });
    }

    const [batch] = await db
      .select({ name: batches.name })
      .from(batches)
      .where(eq(batches.id, String(batchId)))
      .limit(1);

    const rawBatchName = batch?.name?.trim() || "batch";
    const folderName = rawBatchName
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "_");

    const cleanFilename = file.name
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "_");
    const safeFilename = `${Date.now()}_${cleanFilename}`;

    const objectKey = `${folderName}/${safeFilename}`;

    const storage = getStorage();
    const bucket = storage.bucket(getBucketName());
    const gcsFile = bucket.file(objectKey);

    const buffer = Buffer.from(await file.arrayBuffer());
    await gcsFile.save(buffer, {
      metadata: {
        contentType: file.type || "video/mp4",
      },
      resumable: false,
    });

    return NextResponse.json({
      objectKey,
      folderName,
      safeFilename,
    });
  } catch (err: any) {
    console.error("[upload video error]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to upload video to storage." },
      { status: 500 }
    );
  }
}
