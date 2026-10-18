import { spawnSync } from "node:child_process";

// TEMP: report exact formatting adjustments for the team-item change.
if (process.env.CI) {
  const file = "worker/shop/resolveShopUse.ts";
  const formatted = spawnSync("npx", ["prettier", file], { encoding: "utf8" });
  if (formatted.status === 0) {
    const changes = spawnSync("diff", ["-u", file, "-"], {
      input: formatted.stdout,
      encoding: "utf8",
    });
    console.log("TEAM_ITEM_FORMAT_DIFF_BEGIN");
    console.log(changes.stdout || "No diff");
    console.log("TEAM_ITEM_FORMAT_DIFF_END");
    spawnSync("npx", ["prettier", "--write", file], { encoding: "utf8" });
  }
}

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
