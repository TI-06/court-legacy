import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PRESETS = new Set(["smoke", "short", "balance", "long"]);
const DEFAULT_SEEDS = ["phase18-release-a", "phase18-release-b"];

function takeValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseArgs(argv) {
  let preset = "short";
  let output;
  const seeds = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--preset") {
      preset = takeValue(argv, index, "--preset");
      index += 1;
      continue;
    }
    if (argument.startsWith("--preset=")) {
      preset = argument.slice("--preset=".length);
      continue;
    }
    if (argument === "--seed") {
      seeds.push(takeValue(argv, index, "--seed"));
      index += 1;
      continue;
    }
    if (argument.startsWith("--seed=")) {
      seeds.push(argument.slice("--seed=".length));
      continue;
    }
    if (argument === "--output") {
      output = takeValue(argv, index, "--output");
      index += 1;
      continue;
    }
    if (argument.startsWith("--output=")) {
      output = argument.slice("--output=".length);
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      return { help: true, preset, seeds: DEFAULT_SEEDS, output };
    }
    throw new Error(`unknown argument: ${argument}`);
  }

  if (!PRESETS.has(preset)) {
    throw new Error(
      `invalid --preset ${preset}; expected ${[...PRESETS].join(", ")}`,
    );
  }

  const parsedSeeds = seeds
    .flatMap((value) => value.split(","))
    .map((seed) => seed.trim())
    .filter(Boolean);

  return {
    help: false,
    preset,
    seeds: [...new Set(parsedSeeds.length > 0 ? parsedSeeds : DEFAULT_SEEDS)],
    output: output?.trim() || undefined,
  };
}

function printHelp() {
  console.log(
    `Phase18 balance soak\n\nUsage:\n  node scripts/runBalanceSoak.mjs [options]\n\nOptions:\n  --preset smoke|short|balance|long   Horizon (default: short)\n  --seed <seed[,seed...]>             Repeatable deterministic seed\n  --output <directory>                Write JSON and text reports\n  -h, --help                          Show this help\n`,
  );
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(
      `[phase18-soak] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  const vitestEntry = fileURLToPath(
    new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
  );
  const environment = {
    ...process.env,
    PHASE18_SOAK_RUN: "1",
    PHASE18_SOAK_PRESET: options.preset,
    PHASE18_SOAK_SEEDS: options.seeds.join(","),
  };
  if (options.output) {
    environment.PHASE18_SOAK_OUTPUT_DIR = options.output;
  } else {
    delete environment.PHASE18_SOAK_OUTPUT_DIR;
  }

  console.log(
    `[phase18-soak] preset=${options.preset} seeds=${options.seeds.join(",")}${options.output ? ` output=${options.output}` : ""}`,
  );

  const result = spawnSync(
    process.execPath,
    [vitestEntry, "run", "tests/soak/phase18BalanceSoak.test.ts"],
    {
      cwd: process.cwd(),
      env: environment,
      stdio: "inherit",
    },
  );

  if (result.error) {
    console.error(
      `[phase18-soak] failed to start Vitest: ${result.error.message}`,
    );
    process.exitCode = 1;
    return;
  }
  process.exitCode = result.status ?? 1;
}

main();
