import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { findUploadDiskPath, refreshUploadsRootDir } from "@/lib/uploads";

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

/** Never let CDN/browser cache a miss — restored files would stay broken for hours. */
function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  const category = segments?.[0];
  // Private categories — only via authenticated API routes (e.g. certificate download)
  if (category === "certificates" || category === "resumes") {
    return notFound();
  }

  // Align read root with write path (may have fallen back to ./uploads).
  // Also checks legacy public/uploads and public_html/uploads for older files.
  await refreshUploadsRootDir();
  const diskPath = findUploadDiskPath(segments ?? []);
  if (!diskPath) {
    return notFound();
  }

  try {
    const data = await readFile(diskPath);
    const ext = path.extname(diskPath).toLowerCase();
    const contentType = MIME[ext] ?? "application/octet-stream";
    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        // Unique UUID filenames — safe to cache, but not forever-immutable
        // so a same-name restore after deploy can refresh.
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return notFound();
  }
}
