import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { selectAutomaticRest } from "../../../../src/domain/weekly/autoRest";

describe("automatic weekly rest", () => {
  it("does not auto-rest healthy players for legacy fatigue or poor condition", () => {
    const state = createDemoGame();
    const roster = state.schools[state.userSchoolId]!.playerIds;
    const highFatigueId = roster[0]!;
    const poorConditionId = roster[1]!;

    state.players[highFatigueId] = {
      ...state.players[highFatigueId]!,
      fatigue: 100,
      condition: 100,
      injury: null,
    };
    state.players[poorConditionId] = {
      ...state.players[poorConditionId]!,
      fatigue: 0,
      condition: 0,
      injury: null,
    };

    const decisions = selectAutomaticRest(state, state.userSchoolId);

    expect(decisions.some((decision) => decision.playerId === highFatigueId)).toBe(
      false,
    );
    expect(decisions.some((decision) => decision.playerId === poorConditionId)).toBe(
      false,
    );
  });

  it("forces injured players to rest even when legacy fatigue and condition vary", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      fatigue: 90,
      condition: 20,
      injury: {
        injuryId: "injury.ankle",
        severity: "moderate",
        remainingWeeks: 3,
        recurrenceRisk: 20,
      },
    };

    const decisions = selectAutomaticRest(state, state.userSchoolId);

    expect(
      decisions.filter((decision) => decision.playerId === playerId),
    ).toEqual([{ playerId, reason: "injury" }]);
  });

  it("returns injury decisions in stable roster order", () => {
    const state = createDemoGame();
    const roster = state.schools[state.userSchoolId]!.playerIds;
    for (const playerId of roster.slice(0, 3)) {
      state.players[playerId] = {
        ...state.players[playerId]!,
        fatigue: 100,
        condition: 0,
        injury: {
          injuryId: "injury.ankle",
          severity: "minor",
          remainingWeeks: 1,
          recurrenceRisk: 10,
        },
      };
    }

    const decisions = selectAutomaticRest(state, state.userSchoolId);

    expect(decisions.slice(0, 3).map((decision) => decision.playerId)).toEqual(
      roster.slice(0, 3),
    );
    expect(decisions.slice(0, 3).every((decision) => decision.reason === "injury")).toBe(
      true,
    );
  });
});