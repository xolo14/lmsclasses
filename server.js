/**
 * Hostinger / Passenger entry.
 *
 * LiteSpeed always starts nodejs/server.js (PassengerStartupFile=server.js).
 * Bind 0.0.0.0 — Unix HOSTNAME is the machine name and Next would listen
 * on the wrong interface, which shows up as a Hostinger 503.
 */
process.env.HOSTNAME = "0.0.0.0";
process.env.PORT = String(process.env.PORT || "3000").trim() || "3000";

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

try {
  require("./scripts/load-hostinger-env.cjs");
} catch (err) {
  try {
    require("./load-hostinger-env.cjs");
  } catch (err2) {
    console.warn(
      "[server] env helper skipped:",
      (err2 && err2.message) || (err && err.message) || err
    );
  }
}

function exists(file) {
  try {
    return fs.existsSync(file);
  } catch {
    return false;
  }
}

function collectStandaloneCandidates(root) {
  const self = path.resolve(__filename);
  const names = ["server.next.js", "server.js"];
  const dirs = [
    root,
    path.join(root, ".next", "standalone"),
    path.join(root, "standalone"),
  ];

  const standaloneDir = path.join(root, ".next", "standalone");
  if (exists(standaloneDir)) {
    try {
      for (const ent of fs.readdirSync(standaloneDir, { withFileTypes: true })) {
        if (ent.isDirectory() && ent.name !== "node_modules" && ent.name !== ".next") {
          dirs.push(path.join(standaloneDir, ent.name));
        }
      }
    } catch {
      /* ignore */
    }
  }

  const out = [];
  for (const dir of dirs) {
    for (const name of names) {
      const file = path.join(dir, name);
      if (path.resolve(file) === self) continue;
      out.push(file);
    }
  }
  return out;
}

function startStandalone(file) {
  const dir = path.dirname(file);
  console.log(`[server] standalone boot file=${file} cwd=${dir} PORT=${process.env.PORT}`);
  process.chdir(dir);
  require(file);
}

function startNextCli(root) {
  const port = process.env.PORT;
  let nextBin;
  try {
    nextBin = require.resolve("next/dist/bin/next", { paths: [root] });
  } catch {
    nextBin = null;
  }
  if (!nextBin) {
    throw new Error("next/dist/bin/next not found — cannot fall back to next start");
  }
  console.log(`[server] next start fallback -H 0.0.0.0 -p ${port} cwd=${root}`);
  const child = spawn(
    process.execPath,
    [nextBin, "start", "-H", "0.0.0.0", "-p", port],
    { stdio: "inherit", env: process.env, cwd: root }
  );
  child.on("exit", (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code == null ? 0 : code);
  });
}

const roots = Array.from(
  new Set([process.cwd(), __dirname].map((d) => path.resolve(d)))
);

let booted = false;
for (const root of roots) {
  if (booted) break;
  for (const candidate of collectStandaloneCandidates(root)) {
    if (!exists(candidate)) continue;
    try {
      startStandalone(candidate);
      booted = true;
      break;
    } catch (err) {
      console.error(
        `[server] standalone failed (${candidate}):`,
        err && err.stack ? err.stack : err
      );
    }
  }
}

if (!booted) {
  try {
    startNextCli(path.resolve(__dirname));
  } catch (err) {
    console.error("[server] FATAL: could not start Next.js");
    console.error(err && err.stack ? err.stack : err);
    console.error(
      "[server] hPanel: Output directory = .next/standalone, Node 20+, PORT injected, then Redeploy."
    );
    process.exit(1);
  }
}
