/**
 * Prepare Next standalone for Hostinger.
 *
 * Hostinger's Next.js preset skips hidden `.next/` when copying artifacts, so
 * Output=.next/standalone leaves hbuilds/current/nodejs empty (only tmp + logs).
 *
 * Fix in hPanel (required):
 *   Framework preset  = Express  (or Other — there is no "Node.js" preset)
 *   Output directory  = hostinger-app
 *   Entry file        = server.js
 * Next.js preset hides Entry and runs `next start`, so nodejs/ never gets server.js.
 *
 * Hostinger syncs Output → nodejs/, so hostinger-app/server.js becomes nodejs/server.js.
 */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const nextDir = path.join(root, ".next");
const standaloneDir = path.join(nextDir, "standalone");
const standaloneServer = path.join(standaloneDir, "server.js");
const renamedServer = path.join(standaloneDir, "next-server.cjs");
const renamedServerLegacy = path.join(standaloneDir, "server.next.js");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function samePath(a, b) {
  return path.resolve(a) === path.resolve(b);
}

/**
 * Hostinger's version switcher leaves broken symlinks in hbuilds/current and
 * never refreshes the stale nodejs/ folder (mtime stays days old). Passenger
 * still starts hostinger-app/server.js under nodejs/ (Output dir + Entry file).
 */
function publishToPassengerNodejs(srcDir) {
  const skip = new Set(["console.log", "stderr.log"]);
  const candidates = [
    path.resolve(root, "../../current/nodejs/hostinger-app"),
    "/home/u586955688/domains/lmsclasses.com/hbuilds/current/nodejs/hostinger-app",
    path.resolve(root, "../../current/nodejs"),
    "/home/u586955688/domains/lmsclasses.com/hbuilds/current/nodejs",
  ];
  const seen = new Set();
  let published = 0;

  for (const dest of candidates) {
    const resolved = path.resolve(dest);
    if (seen.has(resolved) || samePath(resolved, srcDir)) continue;
    seen.add(resolved);

    try {
      fs.mkdirSync(resolved, { recursive: true });
      for (const name of fs.readdirSync(srcDir)) {
        if (skip.has(name)) continue;
        fs.cpSync(path.join(srcDir, name), path.join(resolved, name), {
          recursive: true,
          force: true,
        });
      }
      const server = path.join(resolved, "server.js");
      if (!fs.existsSync(server)) {
        console.warn("[hostinger-postbuild] publish missing server.js at", resolved);
        continue;
      }
      published += 1;
      console.log("[hostinger-postbuild] published app →", resolved);
      console.log(
        "[hostinger-postbuild] nodejs now contains:",
        fs.readdirSync(resolved).join(", ")
      );
    } catch (err) {
      console.warn(
        "[hostinger-postbuild] could not publish to",
        resolved,
        err && err.message ? err.message : err
      );
    }
  }

  if (published === 0) {
    console.warn(
      "[hostinger-postbuild] WARNING: could not write nodejs/hostinger-app/server.js. In File Manager copy hostinger-app into hbuilds/current/nodejs/."
    );
    return;
  }

  for (const dest of seen) {
    for (const name of ["server.js", "next-server.cjs", "server.next.js"]) {
      const from = path.join(srcDir, name);
      const to = path.join(dest, name);
      if (fs.existsSync(from) && !fs.existsSync(to)) {
        try {
          fs.copyFileSync(from, to);
          console.log("[hostinger-postbuild] filled missing", to);
        } catch (err) {
          console.warn("[hostinger-postbuild] failed to copy", name, err.message);
        }
      }
    }
  }
}

if (!fs.existsSync(standaloneServer) && !fs.existsSync(renamedServer)) {
  console.error(
    "[hostinger-postbuild] Missing .next/standalone/server.js — standalone build failed."
  );
  process.exit(1);
}

const staticSrc = path.join(nextDir, "static");
const staticDest = path.join(standaloneDir, ".next", "static");
if (fs.existsSync(staticSrc)) {
  copyDir(staticSrc, staticDest);
  console.log("[hostinger-postbuild] copied .next/static → standalone");
} else {
  console.warn("[hostinger-postbuild] WARNING: .next/static missing");
}

const publicSrc = path.join(root, "public");
const publicDest = path.join(standaloneDir, "public");
if (fs.existsSync(publicSrc)) {
  copyDir(publicSrc, publicDest);
  console.log("[hostinger-postbuild] copied public → standalone");
}

const envHelperSrc = path.join(root, "scripts", "load-hostinger-env.cjs");
const envHelperDest = path.join(standaloneDir, "load-hostinger-env.cjs");
if (fs.existsSync(envHelperSrc)) {
  fs.copyFileSync(envHelperSrc, envHelperDest);
}

// Wrap Next's server so Hostinger reverse-proxy can reach 0.0.0.0:PORT
if (fs.existsSync(renamedServer)) {
  fs.unlinkSync(renamedServer);
}
if (!fs.existsSync(standaloneServer)) {
  console.error("[hostinger-postbuild] Missing standalone/server.js after cleanup");
  process.exit(1);
}
fs.renameSync(standaloneServer, renamedServer);

const buildIdSrc = path.join(nextDir, "BUILD_ID");
const buildIdDest = path.join(standaloneDir, ".next", "BUILD_ID");
if (fs.existsSync(buildIdSrc)) {
  fs.mkdirSync(path.dirname(buildIdDest), { recursive: true });
  fs.copyFileSync(buildIdSrc, buildIdDest);
}

const wrapper = `/**
 * Hostinger entry (Output=hostinger-app → nodejs/server.js).
 * Generated by scripts/hostinger-postbuild.cjs
 *
 * Always bind 0.0.0.0. Hostinger sets Unix HOSTNAME to the machine name;
 * Next would listen on that name and LiteSpeed returns 503.
 */
process.env.HOSTNAME = "0.0.0.0";
process.env.PORT = String(process.env.PORT || "3000").trim() || "3000";

try {
  require("./load-hostinger-env.cjs");
} catch (err) {
  console.warn("[server] env helper skipped:", err && err.message ? err.message : err);
}

console.log("[server] Hostinger standalone boot PORT=" + process.env.PORT + " HOST=0.0.0.0");
const nextServer = require("fs").existsSync(require("path").join(__dirname, "next-server.cjs"))
  ? "./next-server.cjs"
  : "./server.next.js";
require(nextServer);
`;

fs.writeFileSync(standaloneServer, wrapper, "utf8");
fs.copyFileSync(renamedServer, renamedServerLegacy);
console.log("[hostinger-postbuild] wrote standalone/server.js wrapper + next-server.cjs");

// Also support Output=.next (launcher at .next/server.js → nodejs/server.js)
const nextRootLauncher = `/**
 * Hostinger entry when Output directory is \`.next\`.
 * Prefer Output=.next/standalone instead.
 */
process.env.HOSTNAME = "0.0.0.0";
process.env.PORT = String(process.env.PORT || "3000").trim() || "3000";
const path = require("path");
const fs = require("fs");
try { require("./standalone/load-hostinger-env.cjs"); } catch (e) {}
const target = path.join(__dirname, "standalone", "server.js");
if (!fs.existsSync(target)) {
  console.error("[server] FATAL missing", target);
  process.exit(1);
}
process.chdir(path.join(__dirname, "standalone"));
require(target);
`;
fs.writeFileSync(path.join(nextDir, "server.js"), nextRootLauncher, "utf8");
console.log("[hostinger-postbuild] wrote .next/server.js fallback launcher");

// PassengerRestartDir .../nodejs/tmp
fs.mkdirSync(path.join(standaloneDir, "tmp"), { recursive: true });
fs.writeFileSync(path.join(standaloneDir, "tmp", ".gitkeep"), "");

// Copy out of hidden .next/ — Hostinger does not publish that folder to nodejs/.
const hostingerOut = path.join(root, "hostinger-app");
if (fs.existsSync(hostingerOut)) {
  fs.rmSync(hostingerOut, { recursive: true, force: true });
}
copyDir(standaloneDir, hostingerOut);

const publishedServer = path.join(hostingerOut, "server.js");
if (!fs.existsSync(publishedServer)) {
  console.error("[hostinger-postbuild] FATAL: hostinger-app/server.js missing after copy");
  process.exit(1);
}

const publishedNames = fs.readdirSync(hostingerOut);
console.log(
  "[hostinger-postbuild] copied standalone → ./hostinger-app (" +
    publishedNames.length +
    " entries)"
);
console.log("[hostinger-postbuild] hostinger-app contains:", publishedNames.join(", "));

publishToPassengerNodejs(hostingerOut);

console.log("");
console.log("[hostinger-postbuild] ========== REQUIRED (Passenger) ==========");
console.log("[hostinger-postbuild] Keep Output directory = hostinger-app, Entry = server.js");
console.log("[hostinger-postbuild] NestJS/Express/Other are all OK if those two fields are set");
console.log("[hostinger-postbuild] After deploy, File Manager must show:");
console.log("[hostinger-postbuild]   hbuilds/current/nodejs/server.js");
console.log("[hostinger-postbuild] ============================================");
