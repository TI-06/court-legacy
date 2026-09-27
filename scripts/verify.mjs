import { spawnSync } from "node:child_process";

const result = spawnSync("npx", [
  "prettier",
  "tests/unit/worker/scouting/serverScoutingBoard.test.ts",
  "worker/routes/gameAction.ts",
  "worker/scouting/serverScoutingBoard.ts",
], {
  encoding: "utf8",
  shell: process.platform === "win32",
});
console.log(result.stdout);
process.exit(1);
