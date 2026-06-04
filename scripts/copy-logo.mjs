import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const assetsDir = path.join(root, "assets");
const dest = path.join(publicDir, "lms-logo.jpg");
const legacyDest = path.join(publicDir, "lms-logo.png");

if (fs.existsSync(dest)) {
  console.log("Logo already in repo:", dest, fs.statSync(dest).size, "bytes");
  process.exit(0);
}

const fileSources = [
  path.join(assetsDir, "lms-logo.jpg"),
  path.join(assetsDir, "lms-logo.png"),
];

const dirSources = [
  assetsDir,
  path.join(
    process.env.USERPROFILE || process.env.HOME || "",
    ".cursor",
    "projects",
    "c-Users-nages-Downloads-lms-platform-lms-platform",
    "assets"
  ),
];

function findLatestWhatsApp(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  const files = fs
    .readdirSync(dir)
    .filter((n) => n.includes("WhatsApp_Image"))
    .map((n) => ({
      path: path.join(dir, n),
      mtime: fs.statSync(path.join(dir, n)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return files[0]?.path ?? null;
}

let src = dirSources.map(findLatestWhatsApp).find(Boolean);
if (!src) {
  src = fileSources.find((p) => fs.existsSync(p)) ?? null;
}

if (!src) {
  console.warn(
    "No logo source found (optional on CI if public/lms-logo.jpg is committed)."
  );
  process.exit(0);
}

fs.mkdirSync(publicDir, { recursive: true });
fs.copyFileSync(src, dest);
if (fs.existsSync(legacyDest)) fs.unlinkSync(legacyDest);

// Keep assets/ in sync for future deploys
fs.mkdirSync(assetsDir, { recursive: true });
const assetsCopy = path.join(assetsDir, "lms-logo.jpg");
if (!fs.existsSync(assetsCopy)) {
  fs.copyFileSync(dest, assetsCopy);
}

console.log("Copied", src, "->", dest, fs.statSync(dest).size, "bytes");
