import { mkdir, writeFile } from "fs/promises";
import path from "path";

export type UploadCategory = "course-thumbnails" | "hr-logos" | "resumes";

/** Web path prefix (served from public_html on Hostinger). */
export const UPLOADS_URL_PREFIX = "/uploads";

/**
 * Filesystem root for uploads.
 * Local dev: {project}/public/uploads
 * Hostinger: set UPLOADS_DIR to public_html/uploads, e.g.
 *   /home/USER/domains/lmsclasses.com/public_html/uploads
 */
export function getUploadsRootDir(): string {
  const configured = process.env.UPLOADS_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.join(process.cwd(), "public", "uploads");
}

export function getUploadCategoryDir(category: UploadCategory): string {
  return path.join(getUploadsRootDir(), category);
}

export function getUploadPublicUrl(category: UploadCategory, filename: string): string {
  return `${UPLOADS_URL_PREFIX}/${category}/${filename}`;
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
