import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  runBalanceSoak,
  SOAK_PRESETS,
  type SoakPreset,
} from "../../src/dev/soak/runBalanceSoak";

const enabled = process.env.PHASE18_SOAK_RUN === "1";
const describeSoak = enabled ? describe : describe.skip;
const DEFAULT_SEEDS = ["phase18-release-a", "phase18-release-b"];

function parsePreset(raw: string | undefined): SoakPreset {
  const preset = raw ?? "short";
  if (!(preset in SOAK_PRESETS)) {
    throw new Error(
      `invalid PHASE18_SOAK_PRESET=${preset}; expected ${Object.keys(SOAK_PRESETS).join(", ")}`,
    );
  }
  return preset as SoakPreset;
}

function parseSeeds(raw: string | undefined): string[] {
  const seeds = (raw ?? DEFAULT_SEEDS.join(","))
    .split(",")
    .map((seed) => seed.trim())
    .filter(Boolean);
  if (seeds.length === 0) {
    throw new Error("PHASE18_SOAK_SEEDS must contain at least one seed");
  }
  return [...new Set(seeds)];
}

function safeFilePart(value: string): string {
  return (
    value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "seed"
  );
}

const preset = parsePreset(process.env.PHASE18_SOAK_PRESET);
const seeds = parseSeeds(process.env.PHASE18_SOAK_SEEDS);
const outputDirectory = process.env.PHASE18_SOAK_OUTPUT_DIR?.trim();
const timeoutByPreset: Record<SoakPreset, number> = {
  smoke: 30_000,
  short: 60_000,
  balance: 180_000,
  long: 600_000,
};

if (enabled) {
  vi.setConfig({ testTimeout: timeoutByPreset[preset] });
}

async function writeArtifacts(
  seed: string,
  result: ReturnType<typeof runBalanceSoak>,
): Promise<void> {
  if (!outputDirectory) return;

  const directory = resolve(outputDirectory);
  await mkdir(directory, { recursive: true });
  const baseName = `${safeFilePart(seed)}-${preset}`;
  await Promise.all([
    writeFile(
      resolve(directory, `${baseName}.json`),
      `${JSON.stringify(result.report, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      resolve(directory, `${baseName}.txt`),
      `${result.summary}\n`,
      "utf8",
    ),
  ]);
}

describeSoak("Phase18 release soak presets", () => {
  for (const seed of seeds) {
    it(`runs ${preset} for ${seed} through the production action driver`, async () => {
      const result = runBalanceSoak({ seed, preset });

      expect(result.report.metadata.seed).toBe(seed);
      expect(result.report.metadata.preset).toBe(preset);
      expect(result.report.metadata.completedSeasons).toBe(
        SOAK_PRESETS[preset],
      );
      expect(result.report.metadata.targetSeasons).toBe(SOAK_PRESETS[preset]);
      expect(result.snapshot.state.pendingEvent).toBeNull();
      expect(
        result.snapshot.state.activeMatch === null ||
          result.snapshot.state.activeMatch.phase === "match-complete",
      ).toBe(true);

      console.info(`[phase18-soak] ${result.summary}`);
      for (const observation of result.report.observations) {
        console.info(
          `[phase18-soak][observation] year=${observation.yearIndex} ${observation.code}: ${observation.message}`,
        );
      }
      await writeArtifacts(seed, result);
    });
  }
});
