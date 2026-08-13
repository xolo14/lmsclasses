/**
 * Optional Hostinger entry file (only if hPanel requires a .js entry).
 * Prefer leaving Entry file EMPTY so Hostinger runs `next start` (official Next.js SSR).
 *
 * If Entry file is required, set it to: server.js
 */
const { spawn } = require("child_process");

try {
  require("./scripts/load-hostinger-env.cjs");
} catch (err) {
  console.warn(
    "[server] env helper load skipped:",
    err && err.message ? err.message : err
  );
}

const port = String(process.env.PORT || 3000);
const nextBin = require.resolve("next/dist/bin/next");

console.log(`[server] starting next start -H 0.0.0.0 -p ${port}`);

const child = spawn(
  process.execPath,
  [nextBin, "start", "-H", "0.0.0.0", "-p", port],
  {
    stdio: "inherit",
    env: process.env,
    cwd: __dirname,
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[server] next exited from signal ${signal}`);
    process.exit(1);
  }
  process.exit(code == null ? 0 : code);
});

process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
