/**
 * Copy uploads from legacy folders into the current uploads root.
 *
 * After storage moved off public/uploads and public_html/uploads into
 * ./uploads (or UPLOADS_DIR), older course thumbnails 404 unless copied.
 *
 * Hostinger note: the live app is rebuilt from GitHub (hPanel build), not by
 * hand-editing the nodejs folder. Keep uploads OUTSIDE the deploy folder so
 * rebuilds do not wipe them, e.g. ../persistent-uploads.
 *
 * Run from the app directory (same folder as server.js), or pass --dest:
 *   node scripts/migrate-legacy-uploads.mjs
 *   node scripts/migrate-legacy-uploads.mjs --dry-run
 *   node scripts/migrate-legacy-uploads.mjs --dest=/home/.../persistent-uploads
 *
 * Env alternatives:
 *   DRY_RUN=1 node scripts/migrate-legacy-uploads.mjs
 *   UPLOADS_DIR=/path/to/persistent-uploads node scripts/migrate-legacy-uploads.mjs
 */
import fs from "fs";
import path from "path";

const CATEGORIES = [
  "course-thumbnails",
  "hr-logos",
  "org-logos",
  "certificates",
  "certificate-backgrounds",
  "resumes",
  "live-classes",
  "record-classes",
];

const args = process.argv.slice(2);
const dryRun =
  args.includes("--dry-run") ||
  process.env.DRY_RUN === "1" ||
  process.env.DRY_RUN === "true";
const destArg = args.find((a) => a.startsWith("--dest="))?.slice("--dest=".length)?.trim();

const cwd = process.cwd();
const destRoot = path.resolve(destArg || process.env.UPLOADS_DIR?.trim() || path.join(cwd, "uploads"));

const legacyRoots = [
  path.join(cwd, "public", "uploads"),
  path.join(cwd, "..", "public_html", "uploads"),
  path.join(cwd, "..", "public", "uploads"),
  path.join(cwd, "..", "..", "public_html", "uploads"),
  // Common persistent folder next to the Hostinger app deploy dir
  path.join(cwd, "..", "persistent-uploads"),
  // Previous app-local uploads if cwd moved (e.g. sibling nodejs/uploads)
  path.join(cwd, "..", "nodejs", "uploads"),
]
  .map((p) => path.resolve(p))
  .filter((p, i, arr) => p !== destRoot && arr.indexOf(p) === i && fs.existsSync(p));

console.log(`Destination: ${destRoot}${dryRun ? " (dry run)" : ""}`);
if (!legacyRoots.length) {
  console.log("No legacy upload folders found. Checked:");
  console.log(`  - ${path.join(cwd, "public", "uploads")}`);
  console.log(`  - ${path.resolve(cwd, "..", "public_html", "uploads")}`);
  console.log(`  - ${path.resolve(cwd, "..", "public", "uploads")}`);
  console.log(`  - ${path.resolve(cwd, "..", "persistent-uploads")}`);
  console.log(`  - ${path.resolve(cwd, "..", "nodejs", "uploads")}`);
  process.exit(0);
}

let copied = 0;
let skipped = 0;

for (const legacyRoot of legacyRoots) {
  console.log(`\nScanning: ${legacyRoot}`);
  for (const category of CATEGORIES) {
    const srcDir = path.join(legacyRoot, category);
    if (!fs.existsSync(srcDir)) continue;

    const destDir = path.join(destRoot, category);
    if (!dryRun) fs.mkdirSync(destDir, { recursive: true });

    for (const name of fs.readdirSync(srcDir)) {
      const src = path.join(srcDir, name);
      if (!fs.statSync(src).isFile()) continue;
      const dest = path.join(destDir, name);
      if (fs.existsSync(dest)) {
        skipped += 1;
        continue;
      }
      console.log(`  ${dryRun ? "would copy" : "copy"} ${category}/${name}`);
      if (!dryRun) fs.copyFileSync(src, dest);
      copied += 1;
    }
  }
}

console.log(`\nDone. ${dryRun ? "Would copy" : "Copied"} ${copied} file(s), skipped ${skipped} existing.`);
if (!dryRun && copied > 0) {
  console.log("Restart the Node app if needed, then hard-refresh the courses page.");
}
