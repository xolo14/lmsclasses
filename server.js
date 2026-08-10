/**
 * Hostinger Node.js entry file.
 * hPanel: Entry file = server.js | Build = npm run build | Start = npm start
 *
 * Hostinger hbuilds sometimes does not inject hPanel env into process.env.
 * Load a persistent .env from the domain root (outside versions/) as fallback.
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
    // Do not override vars Hostinger already injected
    if (!process.env[key]?.trim()) {
      process.env[key] = val;
      loaded += 1;
    }
  }
  console.log(`[server] loaded ${loaded} env key(s) from ${filePath}`);
  return loaded > 0;
}

function loadPersistentEnv() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, ".env"),
    path.join(cwd, ".env.production"),
    // hbuilds/versions/<id>/nodejs → domain root (../../../../)
    path.resolve(cwd, "../../../../.env"),
    path.resolve(cwd, "../../../../lms.env"),
    path.resolve(cwd, "../../../.env"),
    path.resolve(cwd, "../../.env"),
    path.resolve(cwd, "../.env"),
    // Known Hostinger path for this site
    "/home/u586955688/domains/lmsclasses.com/.env",
    "/home/u586955688/domains/lmsclasses.com/lms.env",
  ];

  const seen = new Set();
  for (const file of candidates) {
    const resolved = path.resolve(file);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (parseEnvFile(resolved)) return;
  }
  console.warn(
    "[server] no persistent .env found. Set hPanel env vars OR create /home/u586955688/domains/lmsclasses.com/.env"
  );
}

loadPersistentEnv();

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOSTNAME || "0.0.0.0";

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer(async (req, res) => {
      try {
        await handle(req, res, parse(req.url, true));
      } catch (err) {
        console.error("[server] request failed", req.url, err);
        res.statusCode = 500;
        res.end("internal server error");
      }
    }).listen(port, hostname, () => {
      console.log(`[server] ready on http://${hostname}:${port}`);
      console.log(
        `[server] env check: DATABASE_URL=${!!process.env.DATABASE_URL?.trim()} AUTH_SECRET=${!!(
          process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
        )}`
      );
    });
  })
  .catch((err) => {
    console.error("[server] failed to start:", err);
    process.exit(1);
  });
