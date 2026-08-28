import { spawnSync } from "node:child_process";

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
    if (label === "Formatting") {
      spawnSync(
        "npx",
        [
          "prettier",
          "tests/unit/worker/data/SupabaseShopStore.test.ts",
          "tests/unit/worker/shopMigration.test.ts",
          "--write",
        ],
        { encoding: "utf8", shell: process.platform === "win32" },
      );
      const diff = spawnSync("git", ["diff", "--", "tests/unit/worker"], {
        encoding: "utf8",
      });
      if (diff.stdout) {
        console.error(`\n[PRETTIER DIFF]\n${diff.stdout.trim()}`);
      }
    }
    process.exit(result.status ?? 1);
  }

  console.log(`[OK] ${label}`);
}
