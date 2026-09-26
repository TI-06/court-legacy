import { createDemoGame } from "../../../../src/app/createDemoGame";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import type { GameState } from "../../../../src/domain/model/GameState";
import type {
  ScoutingCandidateInsight,
  ScoutingCandidatePool,
  ScoutingCandidateTruth,
} from "../../../../worker/data/ScoutingStore";
import {
  buildServerScoutReports,
  generateServerScoutingCandidateAtIndex,
  generateServerScoutingCandidates,
  scoutingCycleKey,
} from "../../../../worker/scouting/serverScoutingBoard";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const gameData = gameDataBootstrap.data;

function stateExcludedNames(state: GameState): Set<string> {
  return new Set(
    Object.values(state.players).map(
      (player) => `${player.lastName} ${player.firstName}`,
    ),
  );
}

function poolFor(
  state: GameState,
  candidates: ScoutingCandidateTruth[],
): ScoutingCandidatePool {
  return {
    userId: "user-shop-scout",
    cycleKey: scoutingCycleKey(state),
    creationOperationId: "operation-shop-scout",
    candidates,
  };
}

describe("server scouting board Phase 5 integration", () => {
  it("generates the same bounded candidate pool deterministically", () => {
    const state = createDemoGame();
    const first = generateServerScoutingCandidates(state);
    const second = generateServerScoutingCandidates(state);

    expect(first).toEqual(second);
    expect(first).toHaveLength(6);
    expect(new Set(first.map(({ player }) => player.id)).size).toBe(6);
  });

  it("generates index seven deterministically without rerolling the original six", () => {
    const state = createDemoGame();
    const originalSix = generateServerScoutingCandidates(state);
    const excluded = stateExcludedNames(state);

    const first = generateServerScoutingCandidateAtIndex(state, 7, excluded);
    const second = generateServerScoutingCandidateAtIndex(state, 7, excluded);
    const originalNames = new Set(
      originalSix.map(({ player }) => `${player.lastName} ${player.firstName}`),
    );

    expect(second).toEqual(first);
    expect(first.player.id).toBe(
      `scout-${state.userSchoolId}-${state.yearIndex}-0-7`,
    );
    expect(originalNames).not.toContain(
      `${first.player.lastName} ${first.player.firstName}`,
    );
    expect(generateServerScoutingCandidates(state)).toEqual(originalSix);
  });

  it("applies candidate insights without rerolling unaffected public reports", () => {
    const state = createDemoGame();
    const candidates = generateServerScoutingCandidates(state);
    const pool = poolFor(state, candidates);
    const baseline = buildServerScoutReports(state, pool, []);
    const target = candidates[0]!.player.id;
    const insights: ScoutingCandidateInsight[] = [
      {
        candidateId: target,
        overallPrecision: "researched",
        potentialPrecision: "appraised",
      },
    ];

    const improved = buildServerScoutReports(state, pool, insights);
    const repeated = buildServerScoutReports(state, pool, insights);

    expect(improved).toEqual(repeated);
    expect(improved[0]!.confidence).toBe("high");
    expect(improved[0]!.specialAbilityCoverage).toBe("complete");
    expect(improved[0]!.observedSpecialAbilityIds).toEqual(
      candidates[0]!.player.specialAbilityIds,
    );
    expect(
      improved[0]!.estimatedPotential.max - improved[0]!.estimatedPotential.min,
    ).toBeLessThanOrEqual(4);
    expect(improved.slice(1)).toEqual(baseline.slice(1));
    expect(JSON.stringify(improved)).not.toContain('"tier"');
    expect(JSON.stringify(improved)).not.toContain('"hiddenTraitIds"');
  });
});
