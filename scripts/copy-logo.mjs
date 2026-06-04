import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const dest = path.join(publicDir, "lms-logo.png");

const sources = [
  path.join(root, "assets", "lms-logo.png"),
  path.join(
    process.env.USERPROFILE || "",
    ".cursor",
    "projects",
    "c-Users-nages-Downloads-lms-platform-lms-platform",
    "assets"
  ),
];

function findWhatsApp(dir) {
  if (!fs.existsSync(dir)) return null;
  const name = fs.readdirSync(dir).find((n) => n.includes("WhatsApp_Image"));
  return name ? path.join(dir, name) : null;
}

let src = sources.map(findWhatsApp).find(Boolean);
if (!src && fs.existsSync(sources[0])) src = sources[0];

if (!src) {
  console.error("Logo source not found. Place lms-logo.png in public/ or assets/");
  process.exit(1);
}

fs.mkdirSync(publicDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log("Copied", src, "->", dest, fs.statSync(dest).size, "bytes");
