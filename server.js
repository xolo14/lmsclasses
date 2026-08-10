/**
 * Hostinger Node.js entry file.
 * hPanel: Entry file = server.js | Build = npm run build | Start = npm start
 *
 * Env source of truth: Hostinger → Environment variables (injected into process.env).
 * Set AUTH_SECRET, DATABASE_URL, etc. in hPanel, then Save and redeploy.
 */
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOSTNAME || "0.0.0.0";

function envSet(key) {
  return !!process.env[key]?.trim();
}

const authSecretOk = envSet("AUTH_SECRET") || envSet("NEXTAUTH_SECRET");
const databaseOk = envSet("DATABASE_URL");

console.log(
  `[server] env from process (hPanel): DATABASE_URL=${databaseOk} AUTH_SECRET=${authSecretOk} NEXTAUTH_URL=${
    envSet("AUTH_URL") || envSet("NEXTAUTH_URL")
  }`
);

if (!authSecretOk || !databaseOk) {
  console.error(
    "[server] Missing required Hostinger Environment variables. " +
      "In hPanel → Environment variables set DATABASE_URL and AUTH_SECRET (or NEXTAUTH_SECRET), then Save and redeploy."
  );
}

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
