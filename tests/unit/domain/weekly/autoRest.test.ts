import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { selectAutomaticRest } from "../../../../src/domain/weekly/autoRest";

describe("automatic weekly rest", () => {
  it("uses the approved fatigue and condition boundaries", () => {
    const state = createDemoGame();
    const roster = state.schools[state.userSchoolId]!.playerIds;
    const participatesId = roster[0]!;
    const fatigueRestId = roster[1]!;
    const conditionRestId = roster[2]!;

    state.players[participatesId] = {
      ...state.players[participatesId]!,
      fatigue: 64,
      condition: 36,
      injury: null,
    };
    state.players[fatigueRestId] = {
      ...state.players[fatigueRestId]!,
      fatigue: 65,
      condition: 100,
      injury: null,
    };
    state.players[conditionRestId] = {
      ...state.players[conditionRestId]!,
      fatigue: 0,
      condition: 35,
      injury: null,
    };

    const decisions = selectAutomaticRest(state, state.userSchoolId);

    expect(decisions).not.toContainEqual({
      playerId: participatesId,
      reason: "fatigue",
    });
    expect(decisions).not.toContainEqual({
      playerId: participatesId,
      reason: "condition",
    });
    expect(decisions).toContainEqual({
      playerId: fatigueRestId,
      reason: "fatigue",
    });
    expect(decisions).toContainEqual({
      playerId: conditionRestId,
      reason: "condition",
    });
  });

  it("forces injured players to rest and uses stable reason precedence", () => {
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

    expect(decisions.filter((decision) => decision.playerId === playerId)).toEqual(
      [{ playerId, reason: "injury" }],
    );
  });

  it("returns decisions in stable roster order", () => {
    const state = createDemoGame();
    const roster = state.schools[state.userSchoolId]!.playerIds;
    for (const playerId of roster.slice(0, 3)) {
      state.players[playerId] = {
        ...state.players[playerId]!,
        fatigue: 65,
        injury: null,
      };
    }

    const decisions = selectAutomaticRest(state, state.userSchoolId);

    expect(decisions.slice(0, 3).map((decision) => decision.playerId)).toEqual(
      roster.slice(0, 3),
    );
  });
});
