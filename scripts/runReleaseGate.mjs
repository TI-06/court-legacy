import { spawnSync } from "node:child_process";

const commands = [
  ["Release metadata", "npm", ["run", "release:check"]],
  ["Repository verify", "npm", ["run", "verify"]],
  ["Fast soak", "npm", ["run", "soak:smoke"]],
];

if (process.env.COURT_LEGACY_RELEASE_LONG_SOAK === "1") {
  commands.push(["Long soak", "npm", ["run", "soak:long"]]);
}

commands.push(["Mobile E2E", "npm", ["run", "test:e2e"]]);

for (const [label, command, args] of commands) {
  console.log(`\n[release] ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
