import { readFile } from "fs/promises";
import { resolveUploadDiskPath } from "@/lib/uploads";

/** Resolve /uploads/... public URL to an on-disk path for PDF generation. */
export function resolveBackgroundImagePath(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed.startsWith("/uploads/")) return null;
  const segments = trimmed.replace(/^\//, "").replace(/^uploads\//, "").split("/");
  return resolveUploadDiskPath(segments);
}

export async function loadBackgroundImageBuffer(url: string): Promise<Buffer | null> {
  const diskPath = resolveBackgroundImagePath(url);
  if (!diskPath) return null;
  try {
    return await readFile(diskPath);
  } catch {
    return null;
  }
}
