import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const icon32 = path.join(root, "app", "icon.png");
const icon180 = path.join(root, "app", "apple-icon.png");

const logoPath = [
  path.join(root, "public", "lms-logo.jpg"),
  path.join(root, "assets", "lms-logo.jpg"),
  path.join(root, "public", "lms-logo.png"),
].find((p) => fs.existsSync(p));

if (!logoPath) {
  if (fs.existsSync(icon32) && fs.existsSync(icon180)) {
    console.log("Using committed favicons (no logo file to regenerate from).");
    process.exit(0);
  }
  console.error(
    "Missing public/lms-logo.jpg and app/icon.png — commit logo or icons to the repo."
  );
  process.exit(1);
}

async function makeSquareIcon(size, outPath) {
  const pad = Math.round(size * 0.12);
  const logoW = size - pad * 2;
  const logoH = Math.round(logoW * 0.4);

  const logo = await sharp(logoPath)
    .resize(logoW, logoH, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();

  const meta = await sharp(logo).metadata();
  const left = Math.round((size - (meta.width ?? logoW)) / 2);
  const top = Math.round((size - (meta.height ?? logoH)) / 2);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(outPath);

  console.log("Wrote", outPath, size + "x" + size);
}

await makeSquareIcon(32, icon32);
await makeSquareIcon(180, icon180);
