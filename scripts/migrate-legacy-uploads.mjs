/**
 * Copy uploads from legacy folders into the current uploads root.
 *
 * After storage moved off public/uploads and public_html/uploads into
 * ./uploads (or UPLOADS_DIR), older course thumbnails 404 unless copied.
 *
 * Usage (on the server, from the app directory next to server.js):
 *   node scripts/migrate-legacy-uploads.mjs
 *   UPLOADS_DIR=/path/to/nodejs/uploads node scripts/migrate-legacy-uploads.mjs
 *
 * Dry run:
 *   DRY_RUN=1 node scripts/migrate-legacy-uploads.mjs
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

const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const cwd = process.cwd();
const destRoot = path.resolve(process.env.UPLOADS_DIR?.trim() || path.join(cwd, "uploads"));

const legacyRoots = [
  path.join(cwd, "public", "uploads"),
  path.join(cwd, "..", "public_html", "uploads"),
  path.join(cwd, "..", "public", "uploads"),
  path.join(cwd, "..", "..", "public_html", "uploads"),
]
  .map((p) => path.resolve(p))
  .filter((p, i, arr) => p !== destRoot && arr.indexOf(p) === i && fs.existsSync(p));

console.log(`Destination: ${destRoot}${dryRun ? " (dry run)" : ""}`);
if (!legacyRoots.length) {
  console.log("No legacy upload folders found. Checked:");
  console.log(`  - ${path.join(cwd, "public", "uploads")}`);
  console.log(`  - ${path.resolve(cwd, "..", "public_html", "uploads")}`);
  console.log(`  - ${path.resolve(cwd, "..", "public", "uploads")}`);
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
