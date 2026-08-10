/**
 * Hostinger Node.js entry file.
 * hPanel: Entry file = server.js | Build = npm run build | Start = npm start
 */
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
