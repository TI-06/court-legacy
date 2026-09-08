import { readFileSync, writeFileSync } from "node:fs";

function replaceExact(path, oldValue, newValue, expected = 1) {
  const source = readFileSync(path, "utf8");
  const count = source.split(oldValue).length - 1;
  if (count !== expected) {
    throw new Error(`${path}: expected ${expected} matches, found ${count}`);
  }
  writeFileSync(path, source.replaceAll(oldValue, newValue));
}

function addHelperImport(path) {
  const source = readFileSync(path, "utf8");
  const importLine = 'import { advanceWeekFromHome } from "./homeTestHelpers";';
  if (source.includes(importLine)) return;
  const boundary = source.indexOf("\n\n");
  if (boundary < 0) throw new Error(`${path}: import boundary not found`);
  writeFileSync(
    path,
    `${source.slice(0, boundary)}\n${importLine}${source.slice(boundary)}`,
  );
}

const helperUsers = [
  "tests/e2e/app-shell.spec.ts",
  "tests/e2e/event-dialog.spec.ts",
  "tests/e2e/official-tournament-continuity.spec.ts",
  "tests/e2e/official-tournament-flow.spec.ts",
  "tests/e2e/phase10-notifications.spec.ts",
  "tests/e2e/shop-flow.spec.ts",
  "tests/e2e/team-dynamics-flow.spec.ts",
  "tests/e2e/v2-auth-game-flow.spec.ts",
];

for (const path of helperUsers) addHelperImport(path);

const oldHomeClick = 'await page.getByRole("button", { name: "次の週へ進む" }).click();';
for (const path of helperUsers) {
  const source = readFileSync(path, "utf8");
  if (source.includes(oldHomeClick)) {
    writeFileSync(path, source.replaceAll(oldHomeClick, "await advanceWeekFromHome(page);"));
  }
}

replaceExact(
  "tests/e2e/official-tournament-continuity.spec.ts",
  'page.getByRole("button", { name: "次の週へ進む" })',
  'page.getByRole("button", { name: "今週を進める" })',
);
replaceExact(
  "tests/e2e/official-tournament-flow.spec.ts",
  'ホームの「次の週へ進む」で試合を実施します',
  'ホームの「今週を進める」で試合を実施します',
);

replaceExact(
  "src/features/home/homeCommandCenter.ts",
  "    detailLabel: string;\n    timingLabel: string;",
  "    detailLabel: string;\n    detailTitle: string | null;\n    timingLabel: string;",
);
replaceExact(
  "src/features/home/homeCommandCenter.ts",
  "          detailLabel: `${roundLabels[nextOfficial.round]} vs ${nextOfficial.opponent.shortName}`,\n          timingLabel:",
  "          detailLabel: `${roundLabels[nextOfficial.round]} vs ${nextOfficial.opponent.shortName}`,\n          detailTitle: nextOfficial.opponent.displayName,\n          timingLabel:",
);
replaceExact(
  "src/features/home/homeCommandCenter.ts",
  "          detailLabel: `第${nextOfficial.scheduledWeek}週 開幕`,\n          timingLabel:",
  "          detailLabel: `第${nextOfficial.scheduledWeek}週 開幕`,\n          detailTitle: null,\n          timingLabel:",
);
replaceExact(
  "src/features/home/HomeCommandCenter.tsx",
  "              <small>{summary.official.detailLabel}</small>",
  "              <small title={summary.official.detailTitle ?? undefined}>\n                {summary.official.detailLabel}\n              </small>",
);
replaceExact(
  "src/features/home/home-command-center.css",
  "  .home-command-objective__action button {\n    padding-inline: 7px;\n  }",
  "  .home-command-objective strong {\n    overflow: visible;\n    font-size: var(--game-font-body);\n    line-height: 1.2;\n    text-overflow: clip;\n    white-space: normal;\n  }\n\n  .home-command-objective__action button {\n    padding-inline: 7px;\n  }",
);
