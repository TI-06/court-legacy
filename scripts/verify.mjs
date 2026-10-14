import { spawnSync } from "node:child_process";

const phase59Files = [
  "docs/superpowers/specs/2026-10-14-phase59-2-rival-enrollment.md",
  "tests/unit/worker/scouting/rivalEnrollment.test.ts",
  "worker/scouting/serverScoutingBoard.ts",
];
spawnSync("npm", ["exec", "--", "prettier", ...phase59Files, "--write"]);
const phase59Diff = spawnSync("git", ["diff", "--", ...phase59Files], {
  encoding: "utf8",
});
console.log("PHASE59_FORMAT_START\n" + (phase59Diff.stdout ?? "") + "\nPHASE59_FORMAT_END");


const commands = [
  ["Formatting", "npm", ["run", "format:check"]],
  ["Lint", "npm", ["run", "lint"]],
  ["Type check", "npm", ["run", "typecheck"]],
  ["V2 structure", "node", ["scripts/verifyStructureCli.mjs"]],
  ["Unit tests", "npm", ["run", "test"]],
  ["Production build", "npm", ["run", "build"]],
];

for (const [label, command, arguments_] of commands) {
  const result = spawnSync(command, arguments_, {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`\n[FAILED] ${label}`);
    if (result.stdout) {
      console.error(result.stdout.trim());
    }
    if (result.stderr) {
      console.error(result.stderr.trim());
    }
    process.exit(result.status ?? 1);
  }

  console.log(`[OK] ${label}`);
}
