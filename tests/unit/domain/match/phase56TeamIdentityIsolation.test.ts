import { describe, expect, it } from "vitest";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import { simulateMatch } from "../../../../src/domain/match/simulateMatch";
import { matchId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { applyMatchTacticPlan } from "../../../../src/domain/team/matchTactics";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}
const data = gameDataBootstrap.data;

function createState() {
  return generateWorld({
    seed: "phase56-identity-isolation-world",
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
}

function run(
  state: ReturnType<typeof createState>,
  identityMasterySchoolId?: ReturnType<typeof createState>["userSchoolId"],
) {
  const homeSchoolId = state.userSchoolId;
  const awaySchoolId = Object.values(state.schools).find(
    (school) => school.id !== homeSchoolId,
  )!.id;

  return simulateMatch({
    state,
    id: matchId("phase56-identity-isolation-match"),
    homeSchoolId,
    awaySchoolId,
    homeSelection: autoSelectTeam({ state, schoolId: homeSchoolId }),
    awaySelection: autoSelectTeam({ state, schoolId: awaySchoolId }),
    bestOfSets: 3,
    random: new SeededRandom("phase56-identity-isolation-match"),
    ...(identityMasterySchoolId ? { identityMasterySchoolId } : {}),
  });
}

describe("Phase56 team identity match isolation", () => {
  it("does not affect generic or PvP-compatible simulations unless explicitly enabled", () => {
    const low = createState();
    low.teamPlanning.teamIdentity = {
      style: "serve-block",
      mastery: 0,
      weeksInStyle: 0,
      changeCount: 0,
    };

    const mastered = structuredClone(low);
    mastered.teamPlanning.teamIdentity = {
      style: "serve-block",
      mastery: 100,
      weeksInStyle: 40,
      changeCount: 0,
    };

    expect(run(mastered)).toEqual(run(low));
  });

  it("stays neutral when mastery is enabled but tactics contradict the identity", () => {
    const low = createState();
    const homeSchool = low.schools[low.userSchoolId]!;
    homeSchool.tactics = applyMatchTacticPlan(homeSchool.tactics, {
      serve: "safe",
      attack: "balanced",
      block: "read",
    });
    low.teamPlanning.teamIdentity = {
      style: "serve-block",
      mastery: 0,
      weeksInStyle: 0,
      changeCount: 0,
    };

    const mastered = structuredClone(low);
    mastered.teamPlanning.teamIdentity = {
      style: "serve-block",
      mastery: 100,
      weeksInStyle: 40,
      changeCount: 0,
    };

    expect(run(mastered, mastered.userSchoolId)).toEqual(
      run(low, low.userSchoolId),
    );
  });
});
