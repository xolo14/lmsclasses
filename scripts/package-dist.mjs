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

This is NOT a static site — do not upload only to public_html without Node.js.
`
);

console.log("✅ Created dist/ folder — zip it and upload to Hostinger Node.js Web App.");
console.log("   Start command: node server.js");
