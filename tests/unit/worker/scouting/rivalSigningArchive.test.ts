import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { playerId } from "../../../../src/domain/model/identifiers";
import type { ScoutingCandidatePool } from "../../../../worker/data/ScoutingStore";
import {
  archiveReplacedScoutingPool,
  MAX_ARCHIVED_RIVAL_CANDIDATES,
} from "../../../../worker/scouting/rivalSigningArchive";
import { scoutingCycleKey } from "../../../../worker/scouting/serverScoutingBoard";

function setup() {
  const state = createDemoGame();
  state.calendar.weekOfYear = 12;
  state.recruiting = {
    cycleKey: scoutingCycleKey(state),
    committedCandidateIds: [],
    scoutingSearchWeekOfYear: 1,
  };
  const template = structuredClone(
    state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!,
  );
  for (const ability of Object.keys(template.abilities) as Array<
    keyof typeof template.abilities
  >) {
    template.abilities[ability] = 100;
  }
  template.potential = 100;
  template.tier = "elite";
  const player = {
    ...template,
    id: playerId("archived-prospect-1"),
  };
  const pool: ScoutingCandidatePool = {
    userId: "test",
    cycleKey: scoutingCycleKey(state),
    creationOperationId: "search-1",
    candidates: [{ player, middleSchoolAchievement: "national-event" }],
  };
  return { state, pool, player };
}

describe("Phase59-3 bounded server rival archive", () => {
  it("retains an eligible rival candidate and its immutable destination and signing week", () => {
    const { state, pool, player } = setup();
    const archived = archiveReplacedScoutingPool(state, pool);
    expect(archived).toHaveLength(1);
    expect(archived[0]!.player.id).toBe(player.id);
    expect(archived[0]!.schoolId).not.toBe(state.userSchoolId);
    expect(state.schools[archived[0]!.schoolId]).toBeDefined();
    expect(archived[0]!.signingWeekOfYear).toBeLessThanOrEqual(
      state.calendar.weekOfYear,
    );
    expect(archived[0]!.signingWeekOfYear).toBeGreaterThan(1);
  });

  it("keeps older searches, de-duplicates candidates and caps storage at 24", () => {
    const { state, pool } = setup();
    let archived = archiveReplacedScoutingPool(state, pool);
    for (let index = 2; index <= 35; index += 1) {
      pool.candidates[0]!.player.id = playerId(`archived-prospect-${index}`);
      pool.archivedRivalCandidates = archived;
      archived = archiveReplacedScoutingPool(state, pool);
    }
    expect(archived).toHaveLength(MAX_ARCHIVED_RIVAL_CANDIDATES);
    expect(new Set(archived.map((item) => item.player.id)).size).toBe(
      MAX_ARCHIVED_RIVAL_CANDIDATES,
    );
    expect(archived.at(-1)!.player.id).toBe("archived-prospect-35");
  });

  it("does not invent legacy deadlines or archive a user's committed player", () => {
    const { state, pool, player } = setup();
    state.recruiting!.scoutingSearchWeekOfYear = undefined;
    expect(archiveReplacedScoutingPool(state, pool)).toEqual([]);
    state.recruiting!.scoutingSearchWeekOfYear = 1;
    state.recruiting!.committedCandidateIds = [player.id];
    expect(archiveReplacedScoutingPool(state, pool)).toEqual([]);
  });
});
