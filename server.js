/**
 * Hostinger Node.js entry file.
 * hPanel: Entry file = server.js | Build = npm run build | Start = npm start
 *
 * Must listen on process.env.PORT itself (do not only spawn `next start` —
 * Hostinger health checks the entry process and returns 503 if it is not bound).
 */
try {
  require("./scripts/load-hostinger-env.cjs");
} catch (err) {
  console.warn(
    "[server] env helper load skipped:",
    err && err.message ? err.message : err
  );
}

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOSTNAME || "0.0.0.0";

const app = next({
  dev: false,
  hostname,
  port,
  dir: __dirname,
});
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error("[server] request failed:", err);
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    }).listen(port, hostname, () => {
      console.log(`[server] ready on http://${hostname}:${port}`);
    });
  })
  .catch((err) => {
    console.error("[server] failed to start:", err);
    process.exit(1);
  });
