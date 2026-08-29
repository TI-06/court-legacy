import { spawnSync } from "node:child_process";

const prettier = spawnSync(
  "npx",
  ["prettier", "tests/unit/app/GameApp.shop.test.tsx", "--write"],
  { encoding: "utf8", shell: process.platform === "win32" },
);
if (prettier.status !== 0) {
  console.error(prettier.stdout || prettier.stderr);
  process.exit(prettier.status ?? 1);
}
const diff = spawnSync(
  "git",
  ["diff", "--", "tests/unit/app/GameApp.shop.test.tsx"],
  { encoding: "utf8", shell: process.platform === "win32" },
);
console.error("[FORMAT DEBUG] GameApp shop test diff after Prettier");
console.error(diff.stdout.trim());
process.exit(1);
