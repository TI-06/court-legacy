import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import {
  createDefaultTeamPlanning,
  deleteLineupPreset,
  saveLineupPreset,
  setDevelopmentPriorities,
  TeamPlanningValidationError,
} from "../../../../src/domain/team/teamPlanning";

describe("teamPlanning", () => {
  it("starts empty", () => {
    expect(createDefaultTeamPlanning()).toEqual({
      developmentPriorityPlayerIds: [],
      savedLineups: [],
    });
  });

  it("stores up to three unique development-priority players from the user roster", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const selected = school.playerIds.slice(0, 3);

    const updated = setDevelopmentPriorities(state, selected);

    expect(updated.teamPlanning.developmentPriorityPlayerIds).toEqual(selected);
    expect(state.teamPlanning.developmentPriorityPlayerIds).toEqual([]);
  });

  it("rejects duplicate, excessive, or non-roster priority IDs", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const first = school.playerIds[0]!;

    expect(() => setDevelopmentPriorities(state, [first, first])).toThrowError(
      TeamPlanningValidationError,
    );
    expect(() =>
      setDevelopmentPriorities(state, school.playerIds.slice(0, 4)),
    ).toThrowError(TeamPlanningValidationError);
    expect(() =>
      setDevelopmentPriorities(state, ["player-not-on-roster" as typeof first]),
    ).toThrowError(TeamPlanningValidationError);
  });

  it("saves, trims, replaces, and deletes lineup presets without aliasing the source", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });

    const saved = saveLineupPreset(state, {
      slot: 1,
      name: "  ベストメンバー  ",
      selection,
    });
    expect(saved.teamPlanning.savedLineups).toHaveLength(1);
    expect(saved.teamPlanning.savedLineups[0]).toMatchObject({
      slot: 1,
      name: "ベストメンバー",
    });
    expect(saved.teamPlanning.savedLineups[0]!.selection).toEqual(selection);
    expect(saved.teamPlanning.savedLineups[0]!.selection).not.toBe(selection);

    selection.rotation[0]!.playerId = selection.rotation[1]!.playerId;
    expect(
      saved.teamPlanning.savedLineups[0]!.selection.rotation[0]!.playerId,
    ).not.toBe(selection.rotation[0]!.playerId);

    const replacementSelection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const replaced = saveLineupPreset(saved, {
      slot: 1,
      name: "守備重視",
      selection: replacementSelection,
    });
    expect(replaced.teamPlanning.savedLineups).toHaveLength(1);
    expect(replaced.teamPlanning.savedLineups[0]!.name).toBe("守備重視");

    const deleted = deleteLineupPreset(replaced, 1);
    expect(deleted.teamPlanning.savedLineups).toEqual([]);
    expect(deleteLineupPreset(deleted, 1)).toEqual(deleted);
  });

  it("rejects invalid names and invalid saved selections", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });

    expect(() =>
      saveLineupPreset(state, { slot: 1, name: "   ", selection }),
    ).toThrowError(TeamPlanningValidationError);
    expect(() =>
      saveLineupPreset(state, { slot: 1, name: "あ".repeat(25), selection }),
    ).toThrowError(TeamPlanningValidationError);

    const invalid = structuredClone(selection);
    invalid.rotation[1]!.playerId = invalid.rotation[0]!.playerId;
    expect(() =>
      saveLineupPreset(state, { slot: 1, name: "invalid", selection: invalid }),
    ).toThrowError(TeamPlanningValidationError);
  });
});
