import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["prettier", "worker/data/statePatch.ts"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});
console.log("===PRETTIER_OUTPUT_START===");
console.log(result.stdout);
console.log("===PRETTIER_OUTPUT_END===");
process.exit(1);
