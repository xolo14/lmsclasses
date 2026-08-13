/**
 * Optional local entry. On Hostinger use:
 *   Output directory = .next/standalone
 *   Entry file       = server.js
 * so LiteSpeed loads nodejs/server.js from the standalone build.
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

const standaloneServer = path.join(
  __dirname,
  ".next",
  "standalone",
  "server.js"
);

if (!fs.existsSync(standaloneServer)) {
  console.error(
    "[server] FATAL: run npm run build first (needs .next/standalone/server.js)"
  );
  process.exit(1);
}

process.chdir(path.dirname(standaloneServer));
require(standaloneServer);
