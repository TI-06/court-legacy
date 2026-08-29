import { spawnSync } from "node:child_process";

const prettier = spawnSync(
  "npx",
  ["prettier", "src/app/GameApp.tsx", "--write"],
  { encoding: "utf8", shell: process.platform === "win32" },
);
if (prettier.status !== 0) {
  console.error(prettier.stdout || prettier.stderr);
  process.exit(prettier.status ?? 1);
}
const diff = spawnSync("git", ["diff", "--", "src/app/GameApp.tsx"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});
console.error("[FORMAT DEBUG] GameApp diff after Prettier");
console.error(diff.stdout.trim());
process.exit(1);
