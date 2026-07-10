/**
 * Packages Next.js standalone output into ./dist for deployment (ZIP / Hostinger Node).
 * Run: npm run build:dist
 */
import { cpSync, rmSync, mkdirSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const standaloneDir = join(root, ".next", "standalone");
const distDir = join(root, "dist");

if (!existsSync(standaloneDir)) {
  console.error(
    "Missing .next/standalone. Run `next build` with output: 'standalone' in next.config.mjs first."
  );
  process.exit(1);
}

if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}

mkdirSync(distDir, { recursive: true });

cpSync(standaloneDir, distDir, { recursive: true });
cpSync(join(root, ".next", "static"), join(distDir, ".next", "static"), {
  recursive: true,
});
const buildIdPath = join(root, ".next", "BUILD_ID");
if (existsSync(buildIdPath)) {
  cpSync(buildIdPath, join(distDir, ".next", "BUILD_ID"));
}
const staticDir = join(distDir, ".next", "static");
if (!existsSync(staticDir)) {
  console.error("Missing dist/.next/static — login and UI will break (404 on JS/CSS).");
  process.exit(1);
}
const publicDir = join(root, "public");
if (existsSync(publicDir)) {
  cpSync(publicDir, join(distDir, "public"), { recursive: true });
}

writeFileSync(
  join(distDir, "README-DEPLOY.txt"),
  `LMS Platform — production bundle

Start (set PORT in Hostinger or use default 3000):
  node server.js

Or:
  PORT=3000 node server.js

Hostinger Node.js start command:
  node server.js

Required: set all environment variables in hPanel (DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL, etc.)
Do NOT upload .env.local with secrets to public folders — use Hostinger env settings.

Uploads (course images, certificates, logos) — stored outside public/:
  Default: ./uploads next to server.js (no env var needed — RECOMMENDED)
  Optional override in hPanel (use YOUR real username, lowercase /home/):
    UPLOADS_DIR=/home/u123456789/domains/lmsclasses.com/nodejs/uploads
  Do NOT copy literally — replace u123456789 with your Hostinger username.
  If UPLOADS_DIR is wrong, the app falls back to ./uploads automatically.
  Subfolders created automatically: certificate-backgrounds, certificates, org-logos, etc.
  Served by the app at https://your-domain/uploads/...

Meta WhatsApp Cloud API (live class meeting links):
  META_WHATSAPP_TOKEN=permanent token from Meta Developer → WhatsApp → API Setup
  META_WHATSAPP_PHONE_NUMBER_ID=from the same API Setup page
  META_WHATSAPP_TEMPLATE_NAME=live_class_link
  META_WHATSAPP_TEMPLATE_LANGUAGE=en
  META_WHATSAPP_COUNTRY_CODE=+91
  Template body {{1}}-{{5}}, button URL https://{{1}} — see .env.example
  Remove old INTERAKT_* vars if present
  Test: Super Admin → Settings → WhatsApp (Meta Cloud API)

Razorpay (live payments — NOT mock):
  RAZORPAY_KEY_ID=rzp_test_... or rzp_live_...
  RAZORPAY_KEY_SECRET=your_secret
  RAZORPAY_WEBHOOK_SECRET=from Razorpay webhook settings (optional but recommended)
After changing env vars you MUST redeploy / rebuild this app.

Verify deploy: open https://your-domain/api/health
  deployVersion should be "razorpay-v3"
  razorpay.configured should be true
`
);

console.log("✅ Created dist/ folder — zip it and upload to Hostinger Node.js Web App.");
console.log("   Start command: node server.js");
