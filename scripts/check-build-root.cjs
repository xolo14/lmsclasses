/**
 * Warn when Hostinger (or local) has parent package.json/lockfiles that can
 * make Next.js infer the wrong workspace root and break `@/` imports.
 */
const fs = require("fs");
const path = require("path");

const cwd = process.cwd();
console.log(`[build-root] cwd=${cwd}`);

let dir = path.resolve(cwd, "..");
const hits = [];
for (let i = 0; i < 6; i++) {
  const lock = path.join(dir, "package-lock.json");
  const pkg = path.join(dir, "package.json");
  if (fs.existsSync(lock) || fs.existsSync(pkg)) {
    hits.push(dir);
  }
  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
}

if (hits.length) {
  console.warn(
    "[build-root] WARNING: parent package.json/lockfile found — Next may resolve `@/` incorrectly:"
  );
  for (const hit of hits) console.warn(`  - ${hit}`);
  console.warn(
    "[build-root] On Hostinger, delete domain-root package.json, package-lock.json, and node_modules (keep .env)."
  );
} else {
  console.log("[build-root] no parent package.json/lockfile detected");
}
