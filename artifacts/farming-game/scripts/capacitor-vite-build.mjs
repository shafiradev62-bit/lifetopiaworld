import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

process.env.CAPACITOR_BUILD = "1";
const root = fileURLToPath(new URL("..", import.meta.url));
const r = spawnSync("npx", ["vite", "build", "--config", "vite.config.ts"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  shell: true,
});
process.exit(r.status ?? 1);
