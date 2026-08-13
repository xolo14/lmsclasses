/**
 * App entry for local start and Hostinger when the full project is the app root.
 *
 * Hostinger hPanel (required):
 * - Framework: Next.js
 * - Build: npm run build
 * - Output directory: .next
 * - Entry file: server.js
 *
 * With Output=.next, Hostinger syncs `.next/*` → `hbuilds/current/nodejs/`.
 * `postbuild` writes `.next/server.js` so Entry `server.js` resolves there.
 */
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
process.env.PORT = process.env.PORT || "3000";

const path = require("path");
const fs = require("fs");

try {
  require("./scripts/load-hostinger-env.cjs");
} catch (err) {
  console.warn(
    "[server] env helper skipped:",
    err && err.message ? err.message : err
  );
}

const candidates = [
  path.join(__dirname, ".next", "standalone", "server.js"),
  path.join(__dirname, "standalone", "server.js"),
];

const standaloneServer = candidates.find((p) => fs.existsSync(p));
if (!standaloneServer) {
  console.error(
    "[server] FATAL: .next/standalone/server.js missing. Run a successful npm run build first."
  );
  process.exit(1);
}

console.log(`[server] cwd=${process.cwd()}`);
console.log(`[server] starting standalone: ${standaloneServer}`);
process.chdir(path.dirname(standaloneServer));
require(standaloneServer);
