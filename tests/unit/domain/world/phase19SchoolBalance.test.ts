import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { generatePlayer } from "../../../../src/domain/generation/generatePlayer";
import type { Player } from "../../../../src/domain/model/Player";
import { playerId, schoolId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { advanceRivalWorld } from "../../../../src/domain/world/rivalWorldProgression";

function averageAbility(player: Player): number {
  const values = Object.values(player.abilities);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe("Phase19 rival school balance", () => {
  it("applies an explicit school baseline bonus when generating a rival recruit", () => {
    const createBaseInput = () => ({
      schoolId: schoolId("school-rival"),
      grade: 1 as const,
      enrolledYear: 1,
      tier: "normal" as const,
      preferredPosition: "OH" as const,
      data: gameData,
      excludedFullNames: new Set<string>(),
    });
    const normal = generatePlayer({
      ...createBaseInput(),
      id: playerId("player-normal-baseline"),
      random: new SeededRandom("phase19-recruit-baseline"),
    });
    const established = generatePlayer({
      ...createBaseInput(),
      id: playerId("player-established-baseline"),
      abilityBonus: 8,
      random: new SeededRandom("phase19-recruit-baseline"),
    });

    expect(averageAbility(established) - averageAbility(normal)).toBe(8);
  });

  it("develops an established rival school faster than an unknown school with the same roster and infrastructure", () => {
    const createState = (established: boolean) => {
      const state = createDemoGame();
      const rival = Object.values(state.schools).find(
        (school) => school.id !== state.userSchoolId,
      )!;
      state.schools[rival.id] = {
        ...rival,
        reputation: established ? "national-regular" : "unknown",
        reputationPoints: established ? 700 : 20,
        coach: {
          ...rival.coach,
          development: 55,
        },
        facilities: {
          ...rival.facilities,
          gym: 2,
          trainingRoom: 2,
        },
      };
      for (const rivalPlayerId of rival.playerIds) {
        state.players[rivalPlayerId] = {
          ...state.players[rivalPlayerId]!,
          grade: 2,
          tier: "promising",
        };
      }
      return { state, rivalId: rival.id, playerId: rival.playerIds[0]! };
    };

    const unknown = createState(false);
    const established = createState(true);
    const unknownBefore = averageAbility(unknown.state.players[unknown.playerId]!);
    const establishedBefore = averageAbility(
      established.state.players[established.playerId]!,
    );

    const unknownResult = advanceRivalWorld(
      unknown.state,
      gameData,
      new SeededRandom("phase19-rival-development"),
    );
    const establishedResult = advanceRivalWorld(
      established.state,
      gameData,
      new SeededRandom("phase19-rival-development"),
    );
    const unknownGrowth =
      averageAbility(unknownResult.players[unknown.playerId]!) - unknownBefore;
    const establishedGrowth =
      averageAbility(establishedResult.players[established.playerId]!) -
      establishedBefore;

    expect(establishedGrowth).toBeGreaterThan(unknownGrowth);
    expect(establishedGrowth - unknownGrowth).toBeGreaterThanOrEqual(4);
  });
});
