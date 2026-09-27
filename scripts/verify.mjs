import { spawnSync } from "node:child_process";

for (const file of ["src/app/useGameSession.ts", "worker/routes/gameAction.ts"]) {
  const result = spawnSync("npx", ["prettier", file], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  console.log(`===PRETTIER:${file}:START===`);
  console.log(result.stdout);
  console.log(`===PRETTIER:${file}:END===`);
}
process.exit(1);
