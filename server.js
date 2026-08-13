/**
 * OPTIONAL custom entry — NOT for Hostinger Next.js SSR.
 *
 * Hostinger docs (SSR):
 *   Application type: next
 *   Build script: build
 *   Output directory: .next
 *   Entry file: LEAVE EMPTY  ← Hostinger runs `next start` automatically
 *
 * If Entry file is set to `server.js`, LiteSpeed looks for:
 *   hbuilds/current/nodejs/server.js
 * and returns 503 when that path is missing.
 *
 * Use only for local/manual: npm run start:server
 */
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
process.env.PORT = process.env.PORT || "3000";

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

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

if (fs.existsSync(standaloneServer)) {
  console.log(`[server] starting standalone: ${standaloneServer}`);
  process.chdir(path.dirname(standaloneServer));
  require(standaloneServer);
} else {
  const nextBin = require.resolve("next/dist/bin/next");
  const port = String(process.env.PORT || 3000);
  console.log(`[server] starting next start -H 0.0.0.0 -p ${port}`);
  const child = spawn(
    process.execPath,
    [nextBin, "start", "-H", "0.0.0.0", "-p", port],
    { stdio: "inherit", env: process.env, cwd: __dirname }
  );
  child.on("exit", (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code == null ? 0 : code);
  });
}
