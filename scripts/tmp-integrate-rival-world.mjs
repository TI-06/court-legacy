import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");
const importAnchor =
  'import { SeededRandom } from "./domain/random/SeededRandom";\n';
const importLine =
  'import { recordMatchOutcome } from "./domain/world/rivalWorldProgression";\n';
if (!app.includes(importLine)) {
  if (!app.includes(importAnchor)) {
    throw new Error("App import anchor not found");
  }
  app = app.replace(importAnchor, importAnchor + importLine);
}

const oldMatchBlock = `      const updatedState = {
        ...current.gameState,
        randomCursor: simulation.match.randomCursor,
        activeMatch: simulation.match,
        history: {
          ...current.gameState.history,
          matches: [
            ...current.gameState.history.matches,
            {
              matchId: simulation.match.id,
              date: current.gameState.date,
              homeSchoolId: simulation.match.homeSchoolId,
              awaySchoolId: simulation.match.awaySchoolId,
              winnerSchoolId: simulation.analysis.winnerSchoolId,
              homeSetsWon: simulation.match.homeSetsWon,
              awaySetsWon: simulation.match.awaySetsWon,
              tournamentId: null,
            },
          ],
        },
      };
`;
const newMatchBlock = `      const matchState = {
        ...current.gameState,
        randomCursor: simulation.match.randomCursor,
        activeMatch: simulation.match,
      };
      const updatedState = recordMatchOutcome(matchState, {
        matchId: simulation.match.id,
        date: current.gameState.date,
        homeSchoolId: simulation.match.homeSchoolId,
        awaySchoolId: simulation.match.awaySchoolId,
        winnerSchoolId: simulation.analysis.winnerSchoolId,
        homeSetsWon: simulation.match.homeSetsWon,
        awaySetsWon: simulation.match.awaySetsWon,
        tournamentId: null,
      });
`;
if (app.includes(oldMatchBlock)) {
  app = app.replace(oldMatchBlock, newMatchBlock);
} else if (!app.includes("recordMatchOutcome(matchState")) {
  throw new Error("App match-history block not found");
}
writeFileSync(appPath, app);

const worldPath = "src/domain/generation/generateWorld.ts";
let world = readFileSync(worldPath, "utf8");
const worldAnchor = "      rivalryScores: {},\n";
if (!world.includes("destinyRivalSchoolId: null")) {
  if (!world.includes(worldAnchor)) {
    throw new Error("World initializer anchor not found");
  }
  world = world.replace(
    worldAnchor,
    `${worldAnchor}      destinyRivalSchoolId: null,\n`,
  );
}
writeFileSync(worldPath, world);
