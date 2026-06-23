import { mkdir, writeFile } from "fs/promises";
import path from "path";

export type UploadCategory =
  | "course-thumbnails"
  | "hr-logos"
  | "org-logos"
  | "certificates"
  | "certificate-backgrounds"
  | "resumes"
  | "live-classes"
  | "record-classes";

/** URL path prefix — served by app/uploads/[...path]/route.ts */
export const UPLOADS_URL_PREFIX = "/uploads";

const ALLOWED_CATEGORIES = new Set<UploadCategory>([
  "course-thumbnails",
  "hr-logos",
  "org-logos",
  "certificates",
  "certificate-backgrounds",
  "resumes",
  "live-classes",
  "record-classes",
]);

/**
 * Filesystem root for uploads (outside public/ so redeploys don't wipe user files).
 * Local dev: {project}/uploads
 * Hostinger default: {nodejs}/uploads  e.g. /home/u123456789/domains/lmsclasses.com/nodejs/uploads
 * Override with UPLOADS_DIR if needed.
 */
function validateUploadsDir(configured: string): string {
  const trimmed = configured.trim();
  if (!trimmed) {
    throw new Error("UPLOADS_DIR is empty");
  }
  if (/\/USER(\/|$)/i.test(trimmed) || trimmed.includes("USER/domains")) {
    throw new Error(
      "UPLOADS_DIR still contains the placeholder USER. Replace it with your real Hostinger path, e.g. /home/u123456789/domains/lmsclasses.com/nodejs/uploads"
    );
  }
  if (/^\/HOME(\/|$)/i.test(trimmed)) {
    throw new Error(
      "UPLOADS_DIR starts with /HOME — use lowercase /home/... on Linux (e.g. /home/u123456789/domains/lmsclasses.com/nodejs/uploads)"
    );
  }
  return path.resolve(trimmed);
}

export function getUploadsRootDir(): string {
  const configured = process.env.UPLOADS_DIR?.trim();
  if (configured) {
    return validateUploadsDir(configured);
  }
  return path.join(process.cwd(), "uploads");
}

export function getUploadCategoryDir(category: UploadCategory): string {
  return path.join(getUploadsRootDir(), category);
}

export function getUploadPublicUrl(category: UploadCategory, filename: string): string {
  return `${UPLOADS_URL_PREFIX}/${category}/${filename}`;
}

/** Resolve a safe on-disk path under the uploads root (prevents path traversal). */
export function resolveUploadDiskPath(segments: string[]): string | null {
  if (!segments.length || segments.some((s) => !s || s === "." || s === "..")) {
    return null;
  }
  const [category, ...rest] = segments;
  if (!ALLOWED_CATEGORIES.has(category as UploadCategory) || rest.length !== 1) {
    return null;
  }

  const root = path.resolve(getUploadsRootDir());
  const resolved = path.resolve(root, category, rest[0]!);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return null;
  }
  return resolved;
}

export async function saveUploadFile(
  category: UploadCategory,
  filename: string,
  data: Buffer
): Promise<{ diskPath: string; url: string }> {
  const dir = getUploadCategoryDir(category);
  try {
    await mkdir(dir, { recursive: true });
    const diskPath = path.join(dir, filename);
    await writeFile(diskPath, data);
    return { diskPath, url: getUploadPublicUrl(category, filename) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    throw new Error(
      `Cannot save file to ${dir}: ${msg}. Check UPLOADS_DIR in .env (use /home/your-user/domains/lmsclasses.com/nodejs/uploads, not /HOME/USER/...).`
    );
  }
}
