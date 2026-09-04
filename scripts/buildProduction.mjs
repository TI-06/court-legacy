import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

process.env.VITE_SUPABASE_URL ??= "https://wpxfcqxhhsllemujxhdm.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??=
  "sb_publishable_uXHnHxyA4sG1eHg0669IVA_EmXxSAsG";

const executable = (name) =>
  resolve(
    "node_modules",
    ".bin",
    `${name}${process.platform === "win32" ? ".cmd" : ""}`,
  );

for (const [command, args] of [
  ["tsc", ["-b"]],
  ["vite", ["build"]],
]) {
  const result = spawnSync(executable(command), args, {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
