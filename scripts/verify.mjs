import { spawnSync } from "node:child_process";

const files = [
  "src/features/scouting/ScoutingScreen.tsx",
  "src/features/scouting/scouting.css",
];
for (const file of files) {
  const result = spawnSync("npx", ["prettier", file], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  console.log(`===PRETTIER:${file}:START===`);
  console.log(result.stdout);
  console.log(`===PRETTIER:${file}:END===`);
}
process.exit(1);
