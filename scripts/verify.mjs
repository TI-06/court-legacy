import { spawnSync } from "node:child_process";

const phase61Files = [
  "docs/superpowers/specs/2026-10-14-phase61-2-home-dashboard.md",
  "src/features/home/home-phase61.css",
  "tests/e2e/phase61-home-command-desk.spec.ts",
];
spawnSync("npm", ["exec", "--", "prettier", ...phase61Files, "--write"], {
  encoding: "utf8",
});
const phase61Diff = spawnSync("git", ["diff", "--", ...phase61Files], {
  encoding: "utf8",
});
console.log(`PHASE61_FORMAT_START\n${phase61Diff.stdout}\nPHASE61_FORMAT_END`);


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
