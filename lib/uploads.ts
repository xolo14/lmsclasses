import { mkdir, writeFile } from "fs/promises";
import path from "path";

export type UploadCategory =
  | "course-thumbnails"
  | "hr-logos"
  | "resumes"
  | "live-classes"
  | "record-classes";

/** URL path prefix — served by app/uploads/[...path]/route.ts */
export const UPLOADS_URL_PREFIX = "/uploads";

const ALLOWED_CATEGORIES = new Set<UploadCategory>([
  "course-thumbnails",
  "hr-logos",
  "resumes",
  "live-classes",
  "record-classes",
]);

/**
 * Filesystem root for uploads (outside public/ so redeploys don't wipe user files).
 * Local dev: {project}/uploads
 * Hostinger default: {nodejs}/uploads  e.g. /home/USER/domains/lmsclasses.com/nodejs/uploads
 * Override with UPLOADS_DIR if needed.
 */
export function getUploadsRootDir(): string {
  const configured = process.env.UPLOADS_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
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
  await mkdir(dir, { recursive: true });
  const diskPath = path.join(dir, filename);
  await writeFile(diskPath, data);
  return { diskPath, url: getUploadPublicUrl(category, filename) };
}
