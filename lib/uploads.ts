import { access, mkdir, writeFile } from "fs/promises";
import path from "path";
import { constants, existsSync } from "fs";

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

export type UploadsDirDiagnostics = {
  rootDir: string;
  configuredEnv: string | null;
  normalizedEnv: string | null;
  fallbackUsed: boolean;
  warnings: string[];
  cwd: string;
};

let cachedDiagnostics: UploadsDirDiagnostics | null = null;

function defaultUploadsRoot(): string {
  return path.join(process.cwd(), "uploads");
}

/** Fix common Hostinger copy-paste mistakes in UPLOADS_DIR. */
function normalizeUploadsDirInput(configured: string): string {
  let value = configured.trim();
  if (!value) return value;
  value = value.replace(/^\/HOME\b/i, "/home");
  return value;
}

function hasPlaceholderSegment(configured: string): boolean {
  return /\/USER(\/|$)/i.test(configured) || /\bUSER\/domains\b/i.test(configured);
}

async function isWritableDir(dir: string): Promise<boolean> {
  try {
    await mkdir(dir, { recursive: true });
    await access(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveUploadsDir(): UploadsDirDiagnostics {
  const cwd = process.cwd();
  const fallback = defaultUploadsRoot();
  const configuredEnv = process.env.UPLOADS_DIR?.trim() || null;
  const warnings: string[] = [];

  if (!configuredEnv) {
    return {
      rootDir: fallback,
      configuredEnv: null,
      normalizedEnv: null,
      fallbackUsed: true,
      warnings: ["UPLOADS_DIR not set — using ./uploads next to server.js"],
      cwd,
    };
  }

  const normalizedEnv = normalizeUploadsDirInput(configuredEnv);

  if (configuredEnv !== normalizedEnv) {
    warnings.push(`UPLOADS_DIR normalized from "${configuredEnv}" to "${normalizedEnv}" (/HOME → /home).`);
  }

  if (hasPlaceholderSegment(normalizedEnv)) {
    warnings.push(
      'UPLOADS_DIR still contains placeholder "USER". Remove UPLOADS_DIR from hPanel or set a real path OUTSIDE the deploy folder, e.g. /home/u123456789/domains/lmsclasses.com/persistent-uploads. Using ./uploads next to server.js instead.'
    );
    return {
      rootDir: fallback,
      configuredEnv,
      normalizedEnv,
      fallbackUsed: true,
      warnings,
      cwd,
    };
  }

  const resolved = path.resolve(normalizedEnv);
  return {
    rootDir: resolved,
    configuredEnv,
    normalizedEnv,
    fallbackUsed: false,
    warnings,
    cwd,
  };
}

/** Never throws — picks uploads root from env (with fixes) or ./uploads. */
export function getUploadsRootDir(): string {
  if (!cachedDiagnostics) {
    cachedDiagnostics = resolveUploadsDir();
  }
  return cachedDiagnostics.rootDir;
}

export function getUploadsDirDiagnostics(): UploadsDirDiagnostics {
  if (!cachedDiagnostics) {
    cachedDiagnostics = resolveUploadsDir();
  }
  return cachedDiagnostics;
}

/** Re-resolve and verify writability; may switch to ./uploads fallback. */
export async function refreshUploadsRootDir(): Promise<UploadsDirDiagnostics> {
  cachedDiagnostics = null;
  const base = resolveUploadsDir();
  const warnings = [...base.warnings];

  if (await isWritableDir(base.rootDir)) {
    cachedDiagnostics = { ...base, warnings };
    return cachedDiagnostics;
  }

  const fallback = defaultUploadsRoot();
  if (base.rootDir !== fallback) {
    warnings.push(
      `Configured uploads path is not writable: ${base.rootDir}. Using fallback: ${fallback}`
    );
    if (await isWritableDir(fallback)) {
      cachedDiagnostics = {
        ...base,
        rootDir: fallback,
        fallbackUsed: true,
        warnings,
      };
      return cachedDiagnostics;
    }
  }

  warnings.push(`Uploads directory is not writable: ${base.fallbackUsed ? fallback : base.rootDir}`);
  cachedDiagnostics = { ...base, warnings };
  return cachedDiagnostics;
}

export function getUploadCategoryDir(category: UploadCategory): string {
  return path.join(getUploadsRootDir(), category);
}

export function getUploadPublicUrl(category: UploadCategory, filename: string): string {
  return `${UPLOADS_URL_PREFIX}/${category}/${filename}`;
}

/**
 * Older deploys stored files under public/uploads or public_html/uploads.
 * New uploads go to ./uploads (or UPLOADS_DIR). Keep reading legacy roots so
 * existing course thumbnails still resolve after the storage move.
 */
export function getLegacyUploadsRoots(): string[] {
  const cwd = process.cwd();
  const primary = path.resolve(getUploadsRootDir());
  const candidates = [
    path.join(cwd, "public", "uploads"),
    path.join(cwd, "..", "uploads"), // nodejs/uploads when cwd is nodejs/hostinger-app
    path.join(cwd, "..", "public_html", "uploads"),
    path.join(cwd, "..", "public", "uploads"),
    path.join(cwd, "..", "..", "public_html", "uploads"),
    path.join(cwd, "..", "..", "..", "public_html", "uploads"),
    path.join(cwd, "..", "..", "..", "..", "public_html", "uploads"),
    path.join(cwd, "..", "persistent-uploads"),
    path.join(cwd, "..", "..", "..", "..", "persistent-uploads"),
    path.join(cwd, "..", "nodejs", "uploads"),
    "/home/u586955688/domains/lmsclasses.com/persistent-uploads",
    "/home/u586955688/domains/lmsclasses.com/public_html/uploads",
  ];

  const roots: string[] = [];
  const seen = new Set<string>([primary]);
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    roots.push(resolved);
  }
  return roots;
}

function safePathUnderRoot(root: string, category: string, filename: string): string | null {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, category, filename);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    return null;
  }
  return resolved;
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

  return safePathUnderRoot(getUploadsRootDir(), category, rest[0]!);
}

/**
 * Resolve an upload for serving: primary root first, then legacy locations
 * (public/uploads, public_html/uploads) so pre-migration files still display.
 */
export function findUploadDiskPath(segments: string[]): string | null {
  const primary = resolveUploadDiskPath(segments);
  if (!primary) return null;
  if (existsSync(primary)) return primary;

  const [category, filename] = segments;
  if (!category || !filename) return null;

  for (const legacyRoot of getLegacyUploadsRoots()) {
    const candidate = safePathUnderRoot(legacyRoot, category, filename);
    if (candidate && existsSync(candidate)) return candidate;
  }

  return primary;
}

export async function saveUploadFile(
  category: UploadCategory,
  filename: string,
  data: Buffer
): Promise<{ diskPath: string; url: string }> {
  await refreshUploadsRootDir();
  const dir = getUploadCategoryDir(category);
  try {
    await mkdir(dir, { recursive: true });
    const diskPath = path.join(dir, filename);
    await writeFile(diskPath, data);
    return { diskPath, url: getUploadPublicUrl(category, filename) };
  } catch (err) {
    const diag = getUploadsDirDiagnostics();
    const msg = err instanceof Error ? err.message : "Upload failed";
    throw new Error(
      `Cannot save file to ${dir}: ${msg}. ` +
        (diag.configuredEnv
          ? `UPLOADS_DIR="${diag.configuredEnv}" — remove it from hPanel or fix to a path outside the deploy folder, e.g. /home/u123456789/domains/lmsclasses.com/persistent-uploads (lowercase home, real username).`
          : `Using ${diag.rootDir} (cwd: ${diag.cwd}).`)
    );
  }
}
