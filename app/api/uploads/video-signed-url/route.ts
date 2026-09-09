import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { batches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSignedUploadUrl } from "@/lib/gcs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { error } = await requireAuth(["super_admin", "manager", "mentor"]);
  if (error) return error;

  try {
    const body = await request.json();
    const { batchId, filename, contentType } = body;

    if (!batchId || !filename) {
      return NextResponse.json(
        { error: "batchId and filename are required." },
        { status: 400 }
      );
    }

    // Fetch batch to get its name for folder organization
    const [batch] = await db
      .select({ name: batches.name })
      .from(batches)
      .where(eq(batches.id, batchId))
      .limit(1);

    // Sanitize folder name from batch name
    const rawBatchName = batch?.name?.trim() || "batch";
    const folderName = rawBatchName
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "_");

    // Sanitize file name and prefix with timestamp for uniqueness
    const rawFilename = (filename as string).trim();
    const cleanFilename = rawFilename
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "_");
    const safeFilename = `${Date.now()}_${cleanFilename}`;

    // Object key in GCS bucket: {batchName}/{filename}
    const objectKey = `${folderName}/${safeFilename}`;

    const mimeType = (contentType as string) || "video/mp4";
    const signedUrl = await getSignedUploadUrl({
      objectKey,
      contentType: mimeType,
      expiresMs: 2 * 60 * 60 * 1000, // 2 hours for large video uploads
    });

    return NextResponse.json({
      signedUrl,
      objectKey,
      folderName,
      safeFilename,
    });
  } catch (err: any) {
    console.error("[video-signed-url error]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate signed upload URL." },
      { status: 500 }
    );
  }
}
