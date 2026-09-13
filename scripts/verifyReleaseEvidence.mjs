import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const readJson = (path) =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"));
const pkg = readJson("package.json");
const lock = readJson("package-lock.json");
const version = pkg.version;
const releasePath = `docs/releases/v${version}.md`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  /^\d+\.\d+\.\d+$/.test(version),
  `invalid package version: ${version}`,
);
assert(
  version !== "0.0.0",
  "release package version must not remain 0.0.0",
);
assert(
  lock.name === pkg.name,
  "package-lock package name does not match package.json",
);
assert(
  lock.packages?.[""]?.name === pkg.name,
  "package-lock root package name does not match package.json",
);
assert(
  existsSync(resolve(root, releasePath)),
  `missing release document: ${releasePath}`,
);

const gameStateSource = readFileSync(
  resolve(root, "src/domain/model/GameState.ts"),
  "utf8",
);
const schemaMatch = gameStateSource.match(
  /CURRENT_GAME_SCHEMA_VERSION\s*=\s*(\d+)/,
);
assert(schemaMatch, "could not resolve CURRENT_GAME_SCHEMA_VERSION");
const schemaVersion = Number(schemaMatch[1]);
const release = readFileSync(resolve(root, releasePath), "utf8");

for (const heading of [
  "## Release notes",
  "## Required release evidence",
  "## Environment and deployment review",
  "## Database and save-schema review",
  "## Known issues",
  "## Rollback procedure",
  "## Tagging procedure",
]) {
  assert(release.includes(heading), `release document is missing ${heading}`);
}

assert(
  release.includes(`Release version: \`${version}\``),
  "release document version marker is stale",
);
assert(
  release.includes(`Save schema: \`v${schemaVersion}\``),
  "release document save-schema marker is stale",
);
assert(
  release.includes("2026-09-14-phase18-pr18-2-soak-balance-results.md"),
  "release document must reference the Phase18 long-soak report",
);

for (const script of [
  "verify",
  "test:e2e",
  "test:e2e:critical",
  "soak:smoke",
  "soak:long",
  "release:gate",
]) {
  assert(
    typeof pkg.scripts?.[script] === "string",
    `missing required script: ${script}`,
  );
}

console.log(`[OK] release metadata v${version}, save schema v${schemaVersion}`);
