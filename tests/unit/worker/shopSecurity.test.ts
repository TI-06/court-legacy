import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import type { GameState } from "../../../src/domain/model/GameState";
import type { Player } from "../../../src/domain/model/Player";
import { PHASE5_SHOP_ITEMS } from "../../../src/domain/shop/shopCatalog";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { PublishedPvpTeamSnapshot } from "../../../worker/data/PvPStore";
import { buildPvpSimulationState } from "../../../worker/pvp/buildPvpSimulationState";

function defenderSnapshot(state: GameState): PublishedPvpTeamSnapshot {
  const school = structuredClone(state.schools[state.userSchoolId]!);
  const players = Object.fromEntries(
    school.playerIds.map((id) => [id, structuredClone(state.players[id]!)]),
  ) as Record<string, Player>;

  return {
    id: "security-defender-snapshot",
    userId: "security-defender",
    sourceRevision: 4,
    sourceAcademicYear: state.calendar.academicYear,
    sourceYearIndex: state.yearIndex,
    school,
    players,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
    isActive: true,
    publishedAt: "2026-08-29T05:00:00.000Z",
  };
}

describe("Phase 5 shop security boundaries", () => {
  it("does not define direct PvP win, rating, or instant ability manipulation items", () => {
    expect(PHASE5_SHOP_ITEMS.map((item) => item.itemId)).toEqual([
      "extra-scout-candidate",
      "scout-research",
      "potential-appraisal",
      "training-camp",
      "fatigue-recovery",
      "special-coach",
      "training-efficiency-boost",
    ]);

    const publicCatalogText = PHASE5_SHOP_ITEMS.map(
      (item) => `${item.itemId} ${item.displayName} ${item.description}`,
    ).join("\n");
    expect(publicCatalogText).not.toMatch(
      /pvp[-_ ]?win|rating|レート上昇|勝利確定|能力\s*\+20/i,
    );
  });

  it("removes temporary shop effects from ranked PvP simulation state", () => {
    const challengerState = createDemoGame();
    const defenderState = createDemoGame();
    challengerState.shopEffects = {
      nextTrainingGrowthBoost: {
        percent: 20,
        remainingUses: 1,
        sourceItemId: "training-efficiency-boost",
      },
    };

    const result = buildPvpSimulationState({
      challenger: {
        userId: "security-challenger",
        state: challengerState,
        teamSelection: autoSelectTeam({
          state: challengerState,
          schoolId: challengerState.userSchoolId,
        }),
      },
      defender: defenderSnapshot(defenderState),
    });

    expect(result.state.shopEffects).toBeUndefined();
    expect(JSON.stringify(result.state)).not.toContain(
      "training-efficiency-boost",
    );
  });
});
