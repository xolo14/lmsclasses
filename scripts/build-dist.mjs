import { spawnSync } from "node:child_process";

process.env.BUILD_STANDALONE = "1";

const build = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  env: process.env,
  shell: true,
});
if (build.status !== 0) process.exit(build.status ?? 1);

const pack = spawnSync("node", ["scripts/package-dist.mjs"], {
  stdio: "inherit",
  shell: true,
});
process.exit(pack.status ?? 0);
