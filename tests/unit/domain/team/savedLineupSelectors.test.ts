import { createDemoGame } from "../../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { selectSavedLineupSlots } from "../../../../src/domain/team/savedLineupSelectors";

describe("saved lineup selectors", () => {
  it("always returns three ordered empty slots", () => {
    const state = createDemoGame();

    expect(selectSavedLineupSlots(state)).toEqual([
      { slot: 1, preset: null, status: "empty", issueMessage: null },
      { slot: 2, preset: null, status: "empty", issueMessage: null },
      { slot: 3, preset: null, status: "empty", issueMessage: null },
    ]);
  });

  it("marks an authoritative legal preset as valid", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    state.teamPlanning.savedLineups = [
      {
        slot: 2,
        name: "守備重視",
        selection: structuredClone(selection),
      },
    ];

    expect(selectSavedLineupSlots(state)[1]).toMatchObject({
      slot: 2,
      status: "valid",
      issueMessage: null,
      preset: {
        name: "守備重視",
      },
    });
  });

  it("marks a stale preset invalid without silently repairing its snapshot", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const removedId = selection.rotation[0]!.playerId;
    const savedSelection = structuredClone(selection);
    state.teamPlanning.savedLineups = [
      {
        slot: 1,
        name: "旧スタメン",
        selection: savedSelection,
      },
    ];
    state.schools[state.userSchoolId]!.playerIds = state.schools[
      state.userSchoolId
    ]!.playerIds.filter((id) => id !== removedId);

    const invalid = selectSavedLineupSlots(state)[0]!;

    expect(invalid.status).toBe("invalid");
    expect(invalid.issueMessage).toBeTruthy();
    expect(invalid.preset?.selection.rotation[0]?.playerId).toBe(removedId);
    expect(savedSelection.rotation[0]?.playerId).toBe(removedId);
  });
});
