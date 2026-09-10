import { describe, expect, it } from "vitest";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import { simulateMatch } from "../../../../src/domain/match/simulateMatch";
import { matchId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const data = gameDataBootstrap.data;

it("keeps one-shot RandomSource cursor consumption compatible", () => {
  const state = generateWorld({
    seed: "phase16-random-compat-world",
    userSchool: {
      name: "蒼波高校",
      shortName: "蒼波",
      regionId: "region.test",
      coachName: "高城 監督",
      uniform: {
        primary: "#173B52",
        secondary: "#F4F7F8",
        accent: "#D89A2B",
      },
    },
    data,
  });
  const homeSchoolId = state.userSchoolId;
  const awaySchoolId = Object.values(state.schools).find(
    (school) => school.id !== homeSchoolId,
  )!.id;
  const random = new SeededRandom("phase16-random-compat", 17);

  const result = simulateMatch({
    state,
    id: matchId("phase16-random-compat-match"),
    homeSchoolId,
    awaySchoolId,
    homeSelection: autoSelectTeam({ state, schoolId: homeSchoolId }),
    awaySelection: autoSelectTeam({ state, schoolId: awaySchoolId }),
    bestOfSets: 3,
    random,
  });

  expect(random.cursor).toBe(result.match.randomCursor);
  expect(random.cursor).toBeGreaterThan(17);
});
