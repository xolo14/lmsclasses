import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { resolveUploadDiskPath, refreshUploadsRootDir } from "@/lib/uploads";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  const category = segments?.[0];
  // Private categories — only via authenticated API routes (e.g. certificate download)
  if (category === "certificates" || category === "resumes") {
    return new NextResponse("Not found", { status: 404 });
  }

  // Align read root with write path (may have fallen back to ./uploads)
  await refreshUploadsRootDir();
  const diskPath = resolveUploadDiskPath(segments ?? []);
  if (!diskPath) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await readFile(diskPath);
    const ext = path.extname(diskPath).toLowerCase();
    const contentType = MIME[ext] ?? "application/octet-stream";
    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
