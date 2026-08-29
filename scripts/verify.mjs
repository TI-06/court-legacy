import { spawnSync } from "node:child_process";

const prettier = spawnSync(
  "npx",
  ["prettier", "src/app/GameApp.tsx", "--write"],
  { encoding: "utf8", shell: process.platform === "win32" },
);
if (prettier.status !== 0) {
  console.error(prettier.stdout || prettier.stderr);
  process.exit(prettier.status ?? 1);
}
const diff = spawnSync("git", ["diff", "--", "src/app/GameApp.tsx"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});
console.error("[FORMAT DEBUG] GameApp diff after Prettier");
console.error(diff.stdout.trim());

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
