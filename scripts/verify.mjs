import { spawnSync } from "node:child_process";

const formatted = spawnSync("npm", ["exec", "--", "prettier", "tests/unit/diagnostics/phase40SaveEndurance.test.ts", "--write"], { encoding: "utf8" });
const formatDiff = spawnSync("git", ["diff", "--", "tests/unit/diagnostics/phase40SaveEndurance.test.ts"], { encoding: "utf8" });
console.log("FORMAT_DEBUG_START\\n" + (formatted.stderr ?? "") + (formatDiff.stdout ?? "") + "\\nFORMAT_DEBUG_END");

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
