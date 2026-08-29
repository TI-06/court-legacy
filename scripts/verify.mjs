import { spawnSync } from "node:child_process";

const targets = [
  "src/app/createBrowserAppDependencies.ts",
  "src/app/StaticShopHarness.ts",
];
const formatter = spawnSync("npx", ["prettier", ...targets, "--write"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});
if (formatter.status !== 0) {
  console.error(formatter.stdout);
  console.error(formatter.stderr);
  process.exit(formatter.status ?? 1);
}
const formatDiff = spawnSync("git", ["diff", "--", ...targets], {
  encoding: "utf8",
  shell: process.platform === "win32",
});
console.log("[FORMAT DEBUG] shop harness source diff after Prettier 3.9.6");
console.log(formatDiff.stdout.trim() || "(no diff)");

const commands = [
  ["Formatting", "npm", ["run", "format:check"]],
  ["Lint", "npm", ["run", "lint"]],
  ["Type check", "npm", ["run", "typecheck"]],
  ["V2 structure", "node", ["scripts/verifyStructureCli.mjs"]],
  [
    "Production dependency audit",
    "npm",
    ["audit", "--omit=dev", "--audit-level=high"],
  ],
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
