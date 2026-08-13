/**
 * Hostinger Node.js entry file.
 *
 * hPanel recommended:
 * - Framework: Next.js
 * - Build: npm run build
 * - Output: .next
 * - Entry file: server.js  (or empty if Hostinger runs npm start)
 * - Start: npm start
 *
 * Listens on process.env.PORT (required by Hostinger).
 */
try {
  require("./scripts/load-hostinger-env.cjs");
} catch (err) {
  console.warn(
    "[server] env helper load skipped:",
    err && err.message ? err.message : err
  );
}

const fs = require("fs");
const path = require("path");
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOSTNAME || "0.0.0.0";

function findAppDir() {
  const candidates = [
    process.cwd(),
    __dirname,
    path.join(process.cwd(), "repository"),
    path.join(__dirname, "repository"),
    path.join(__dirname, ".."),
  ];
  for (const dir of candidates) {
    const resolved = path.resolve(dir);
    if (
      fs.existsSync(path.join(resolved, ".next")) &&
      fs.existsSync(path.join(resolved, "package.json"))
    ) {
      return resolved;
    }
  }
  return path.resolve(process.cwd());
}

const appDir = findAppDir();
const nextDir = path.join(appDir, ".next");

console.log(`[server] cwd=${process.cwd()}`);
console.log(`[server] __dirname=${__dirname}`);
console.log(`[server] appDir=${appDir}`);
console.log(`[server] PORT=${port} HOST=${hostname}`);
console.log(`[server] .next exists=${fs.existsSync(nextDir)}`);

if (!fs.existsSync(nextDir)) {
  console.error(
    "[server] FATAL: .next folder missing. Build must succeed before start. Check Deployments build log."
  );
  process.exit(1);
}

const app = next({
  dev: false,
  hostname,
  port,
  dir: appDir,
});
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error("[server] request failed:", err);
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });

    server.listen(port, hostname, () => {
      console.log(`[server] ready on http://${hostname}:${port}`);
    });

    server.on("error", (err) => {
      console.error("[server] listen error:", err);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error("[server] failed to prepare Next.js:", err);
    process.exit(1);
  });
