import { spawnSync } from "node:child_process";

const prettier = spawnSync(
  "npx",
  ["prettier", "tests/unit/features/shop/ShopScreen.test.tsx", "--write"],
  { encoding: "utf8", shell: process.platform === "win32" },
);
if (prettier.status !== 0) {
  console.error(prettier.stdout || prettier.stderr);
  process.exit(prettier.status ?? 1);
}
const diff = spawnSync(
  "git",
  ["diff", "--", "tests/unit/features/shop/ShopScreen.test.tsx"],
  { encoding: "utf8", shell: process.platform === "win32" },
);
console.error("[FORMAT DEBUG] ShopScreen test diff after Prettier");
console.error(diff.stdout.trim());
process.exit(1);
