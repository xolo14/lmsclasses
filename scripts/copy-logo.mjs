import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const dest = path.join(publicDir, "lms-logo.jpg");
const legacyDest = path.join(publicDir, "lms-logo.png");

const sources = [
  path.join(root, "assets", "lms-logo.jpg"),
  path.join(root, "assets", "lms-logo.png"),
  path.join(
    process.env.USERPROFILE || "",
    ".cursor",
    "projects",
    "c-Users-nages-Downloads-lms-platform-lms-platform",
    "assets"
  ),
];

function findLatestWhatsApp(dir) {
  if (!fs.existsSync(dir)) return null;
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

let src = sources.map(findLatestWhatsApp).find(Boolean);
if (!src) {
  src = sources.find((p) => fs.existsSync(p)) ?? null;
}

if (!src) {
  console.error("Logo source not found. Place image in public/lms-logo.jpg or assets/");
  process.exit(1);
}

fs.mkdirSync(publicDir, { recursive: true });
fs.copyFileSync(src, dest);
if (fs.existsSync(legacyDest)) fs.unlinkSync(legacyDest);
console.log("Copied", src, "->", dest, fs.statSync(dest).size, "bytes");
