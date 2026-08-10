/**
 * Hostinger Node.js entry file.
 * hPanel: Entry file = server.js | Build = npm run build | Start = npm start
 *
 * 1) Prefer Hostinger Environment variables (process.env).
 * 2) If hPanel list is empty (common bug), load domain-root .env as fallback
 *    from /home/.../domains/lmsclasses.com/.env (outside hbuilds — survives redeploy).
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
    console.log(`[server] loaded ${loaded} env key(s) from ${filePath}`);
  }
  return loaded > 0;
}

function loadEnvFallback() {
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
    if (parseEnvFile(resolved)) return true;
  }
  return false;
}

function envSet(key) {
  return !!process.env[key]?.trim();
}

const hadPanelEnv =
  envSet("DATABASE_URL") || envSet("AUTH_SECRET") || envSet("NEXTAUTH_SECRET");

if (!hadPanelEnv) {
  console.warn(
    "[server] No AUTH/DB env in process.env (hPanel Environment variables empty?). Trying domain-root .env fallback…"
  );
  loadEnvFallback();
}

const authSecretOk = envSet("AUTH_SECRET") || envSet("NEXTAUTH_SECRET");
const databaseOk = envSet("DATABASE_URL");

console.log(
  `[server] env ready: DATABASE_URL=${databaseOk} AUTH_SECRET=${authSecretOk} source=${
    hadPanelEnv ? "hPanel" : "file-fallback-or-missing"
  }`
);

if (!authSecretOk || !databaseOk) {
  console.error(
    "[server] Still missing DATABASE_URL / AUTH_SECRET. " +
      "Either fix hPanel → Environment variables (Save and redeploy), " +
      "OR create /home/u586955688/domains/lmsclasses.com/.env with real values."
  );
}

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
    });
  })
  .catch((err) => {
    console.error("[server] failed to start:", err);
    process.exit(1);
  });
