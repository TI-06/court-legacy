import { spawnSync } from "node:child_process";

const phase60Files = [
  "src/domain/match/simulateMatch.ts",
  "src/domain/player/scoringSpecialAbility.ts",
  "tests/unit/domain/match/simulateMatch.test.ts",
  "tests/unit/domain/player/scoringSpecialAbility.test.ts",
];
spawnSync("npm", ["exec", "--", "prettier", ...phase60Files, "--write"]);
const phase60Diff = spawnSync("git", ["diff", "--", ...phase60Files], {
  encoding: "utf8",
});
console.log("PHASE60_FORMAT_START\n" + (phase60Diff.stdout ?? "") + "\nPHASE60_FORMAT_END");


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
