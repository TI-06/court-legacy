import { spawnSync } from "node:child_process";

const prettierFiles = [
  "worker/data/jsonStatePatch.ts",
  "tests/unit/worker/data/jsonStatePatch.test.ts",
];
const prettier = spawnSync(
  "npm",
  ["exec", "--", "prettier", "--write", ...prettierFiles],
  {
    encoding: "utf8",
    shell: process.platform === "win32",
  },
);
if (prettier.status !== 0) {
  console.error(prettier.stdout);
  console.error(prettier.stderr);
  process.exit(prettier.status ?? 1);
}
const diff = spawnSync("git", ["diff", "--", ...prettierFiles], {
  encoding: "utf8",
});
console.error("\n[PRETTIER DIFF]\n" + diff.stdout);
process.exit(1);
