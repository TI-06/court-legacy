import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  autoSelectTeam,
  resolveLockedStarters,
} from "../../../../src/domain/team/autoSelectTeam";

describe("Phase 12 fatigue-independent team selection", () => {
  it("keeps healthy players eligible even when legacy fatigue is high", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;

    for (const playerId of school.playerIds) {
      state.players[playerId] = {
        ...state.players[playerId]!,
        fatigue: 100,
        injury: null,
      };
    }

    const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });
    expect(selection.rotation).toHaveLength(6);
    expect(selection.liberoPlayerId).not.toBeNull();
  });

  it("does not safety-bench a locked starter solely for legacy fatigue", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });
    const lockedPlayerId = selection.rotation[0]!.playerId;
    selection.substitutionPolicy.starterLockPlayerIds = [lockedPlayerId];
    selection.substitutionPolicy.allowFatigueBenching = true;
    state.players[lockedPlayerId] = {
      ...state.players[lockedPlayerId]!,
      fatigue: 100,
      injury: null,
    };

    const result = resolveLockedStarters({
      state,
      schoolId: state.userSchoolId,
      selection,
    });

    expect(result.replacements).toEqual([]);
    expect(result.selection.rotation.some((item) => item.playerId === lockedPlayerId)).toBe(true);
  });
});
