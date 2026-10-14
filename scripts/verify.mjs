import { spawnSync } from "node:child_process";

const formatFiles = [
  "src/features/match/LiveCourtAnimation.tsx",
  "src/features/match/liveCourtMoment.ts",
];
spawnSync("npm", ["exec", "--", "prettier", ...formatFiles, "--write"]);
const diff = spawnSync("git", ["diff", "--", ...formatFiles], {
  encoding: "utf8",
});
console.log("COURT_FORMAT_START\\n" + (diff.stdout ?? "") + "\\nCOURT_FORMAT_END");


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
