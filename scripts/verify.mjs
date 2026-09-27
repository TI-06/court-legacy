import { spawnSync } from "node:child_process";

const formatted = spawnSync(
  "npx",
  ["prettier", "worker/game/actionSchema.ts"],
  { encoding: "utf8", shell: process.platform === "win32" },
);
console.log("===PRETTIER_OUTPUT_START===");
console.log(formatted.stdout);
console.log("===PRETTIER_OUTPUT_END===");
process.exit(1);
