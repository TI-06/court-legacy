import { createDemoGame } from "../../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import {
  calculateSelectionStrength,
  selectPracticeOpponent,
} from "../../../../src/domain/selectors/matchSelectors";

describe("match selectors", () => {
  it("selects a deterministic rival school other than the user school", () => {
    const state = createDemoGame();

    const first = selectPracticeOpponent(state);
    const second = selectPracticeOpponent(state);

    expect(first.id).not.toBe(state.userSchoolId);
    expect(second.id).toBe(first.id);
    expect(state.schools[first.id]).toBe(first);
  });

  it("returns an integer strength that decreases when active players are exhausted", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const restedStrength = calculateSelectionStrength(state, selection);
    const exhaustedPlayers = new Set([
      ...selection.rotation.map((assignment) => assignment.playerId),
      ...(selection.liberoPlayerId ? [selection.liberoPlayerId] : []),
    ]);
    const exhaustedState = {
      ...state,
      players: Object.fromEntries(
        Object.entries(state.players).map(([playerId, player]) => [
          playerId,
          exhaustedPlayers.has(playerId)
            ? { ...player, fatigue: 100, condition: 20 }
            : player,
        ]),
      ),
    };

    const exhaustedStrength = calculateSelectionStrength(
      exhaustedState,
      selection,
    );

    expect(Number.isInteger(restedStrength)).toBe(true);
    expect(exhaustedStrength).toBeLessThan(restedStrength);
  });
});
