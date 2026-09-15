import { createDemoGame } from "../../../../src/app/createDemoGame";
import { loadGameData } from "../../../../src/data/dataRegistry";
import { rawGameData } from "../../../../src/data/rawGameData";
import { playerId } from "../../../../src/domain/model/identifiers";
import {
  assignCharacterTraitDeterministically,
  ensureCharacterTraitAssignments,
} from "../../../../src/domain/player/characterTraitAssignment";

const data = loadGameData(rawGameData);
const characterTraitIds = [...data.characterTraits.keys()];

describe("Phase21 character trait assignment", () => {
  it("returns the same assignment for the same seed and player id", () => {
    const first = assignCharacterTraitDeterministically(
      "phase21-seed",
      playerId("player-001"),
      characterTraitIds,
    );
    const second = assignCharacterTraitDeterministically(
      "phase21-seed",
      playerId("player-001"),
      [...characterTraitIds].reverse(),
    );

    expect(second).toEqual(first);
    expect(first.hiddenTraitIds).toHaveLength(
      Math.min(1, first.hiddenTraitIds.length),
    );
    expect(first.hiddenTraitAssignmentInitialized).toBe(true);
  });

  it("assigns at most one character trait and stays near the fixed 60 percent rate", () => {
    const assignments = Array.from({ length: 10_000 }, (_, index) =>
      assignCharacterTraitDeterministically(
        "phase21-distribution",
        playerId(`distribution-${index}`),
        characterTraitIds,
      ),
    );
    const assignedCount = assignments.filter(
      (assignment) => assignment.hiddenTraitIds.length === 1,
    ).length;

    expect(
      assignments.every((assignment) => assignment.hiddenTraitIds.length <= 1),
    ).toBe(true);
    expect(assignedCount / assignments.length).toBeGreaterThanOrEqual(0.58);
    expect(assignedCount / assignments.length).toBeLessThanOrEqual(0.62);
  });

  it("preserves players whose hidden assignment was already initialized", () => {
    const state = structuredClone(createDemoGame());
    const school = state.schools[state.userSchoolId]!;
    const initializedPlayerId = school.playerIds[0]!;
    const initializedPlayer = state.players[initializedPlayerId]!;
    initializedPlayer.hiddenTraitIds = ["character.caring"];
    initializedPlayer.revealedHiddenTraitIds = ["character.caring"];
    initializedPlayer.hiddenTraitAssignmentInitialized = true;

    const next = ensureCharacterTraitAssignments(state, data);

    expect(next.players[initializedPlayerId]!.hiddenTraitIds).toEqual([
      "character.caring",
    ]);
    expect(next.players[initializedPlayerId]!.revealedHiddenTraitIds).toEqual([
      "character.caring",
    ]);
  });

  it("backfills uninitialized players without consuming the game random cursor", () => {
    const state = structuredClone(createDemoGame());
    for (const player of Object.values(state.players)) {
      player.hiddenTraitIds = [];
      player.revealedHiddenTraitIds = [];
      player.hiddenTraitAssignmentInitialized = false;
    }
    const cursorBefore = state.randomCursor;

    const next = ensureCharacterTraitAssignments(state, data);

    expect(next.randomCursor).toBe(cursorBefore);
    expect(
      Object.values(next.players).every(
        (player) => player.hiddenTraitAssignmentInitialized === true,
      ),
    ).toBe(true);
    expect(
      Object.values(next.players).every(
        (player) => player.hiddenTraitIds.length <= 1,
      ),
    ).toBe(true);
  });
});
