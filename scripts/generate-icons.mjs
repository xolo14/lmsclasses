import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconPath = path.join(root, "app", "icon.png");
const applePath = path.join(root, "app", "apple-icon.png");
const publicIcon = path.join(root, "public", "favicon.png");

const logoPath = [
  path.join(root, "public", "lms-logo.jpg"),
  path.join(root, "assets", "lms-logo.jpg"),
  path.join(root, "public", "lms-logo.png"),
].find((p) => fs.existsSync(p));

if (!logoPath) {
  if (fs.existsSync(iconPath) && fs.existsSync(applePath)) {
    console.log("Using committed favicons (no logo file to regenerate from).");
    process.exit(0);
  }
  console.error(
    "Missing public/lms-logo.jpg and app/icon.png — commit logo or icons to the repo."
  );
  process.exit(1);
}

/** Square favicon: logo scaled to fill ~88% of canvas, white background. */
async function makeSquareIcon(size, outPath) {
  const pad = Math.max(2, Math.round(size * 0.06));
  const inner = size - pad * 2;

  const meta = await sharp(logoPath).metadata();
  const aspect = (meta.width || 3) / (meta.height || 1);

  let logoW = inner;
  let logoH = Math.round(inner / aspect);
  if (logoH > inner) {
    logoH = inner;
    logoW = Math.round(inner * aspect);
  }

  const logo = await sharp(logoPath)
    .resize(logoW, logoH, { fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logo).metadata();
  const w = logoMeta.width ?? logoW;
  const h = logoMeta.height ?? logoH;
  const left = Math.round((size - w) / 2);
  const top = Math.round((size - h) / 2);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logo, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  console.log("Wrote", outPath, size + "x" + size);
}

// 48px source — browsers scale down sharper than a native 32px export
await makeSquareIcon(48, iconPath);
await makeSquareIcon(180, applePath);
await makeSquareIcon(32, publicIcon);
fs.copyFileSync(applePath, path.join(root, "public", "apple-icon.png"));
