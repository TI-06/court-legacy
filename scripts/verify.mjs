import { spawnSync } from "node:child_process";

const commands = [
  [
    "Formatting",
    "bash",
    [
      "-lc",
      "npx prettier src/domain/dynamics/playerOpportunityPromises.ts tests/unit/domain/dynamics/playerOpportunityPromises.test.ts tests/unit/features/match/PreMatchLineupScreen.test.tsx worker/game/applyServerGameAction.ts --write && git diff -- src/domain/dynamics/playerOpportunityPromises.ts tests/unit/domain/dynamics/playerOpportunityPromises.test.ts tests/unit/features/match/PreMatchLineupScreen.test.tsx worker/game/applyServerGameAction.ts && exit 1",
    ],
  ],
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
