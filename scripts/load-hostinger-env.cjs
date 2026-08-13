/**
 * CJS env loader for server.js (Hostinger entry).
 * Mirrors lib/hostinger-env.ts for CommonJS require().
 */
const fs = require("fs");
const path = require("path");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const text = fs.readFileSync(filePath, "utf8");
  let loaded = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]?.trim()) {
      process.env[key] = val;
      loaded += 1;
    }
  }
  if (loaded > 0) {
    console.log(`[env] loaded ${loaded} key(s) from ${filePath}`);
  }
  return loaded > 0;
}

function loadHostingerEnv() {
  const hasCore =
    !!process.env.DATABASE_URL?.trim() &&
    !!(process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim());

  if (hasCore) {
    console.log("[env] using process.env (hPanel Environment variables)");
    return;
  }

  console.warn(
    "[env] DATABASE_URL/AUTH_SECRET missing from process.env — trying domain-root .env fallback"
  );

  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, ".env"),
    path.resolve(cwd, "../../../../.env"),
    path.resolve(cwd, "../../../../lms.env"),
    "/home/u586955688/domains/lmsclasses.com/.env",
    "/home/u586955688/domains/lmsclasses.com/lms.env",
  ];

  const seen = new Set();
  for (const file of candidates) {
    const resolved = path.resolve(file);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (parseEnvFile(resolved)) break;
  }
}

loadHostingerEnv();
