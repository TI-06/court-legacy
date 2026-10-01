import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  activeInvitationalCup,
  createInvitationalCup,
  invitationalMatchId,
  recordInvitationalOutcome,
} from "../../../../src/domain/school/invitationalCup";
import type { MatchState } from "../../../../src/domain/model/Match";

function readyState() {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  school.reputationPoints = 900;
  school.reputation = "elite";
  school.history.nationalTitles = 1;
  school.facilities.gym = 50;
  school.facilities.analysisRoom = 50;
  return state;
}

function completedMatch(input: {
  id: NonNullable<ReturnType<typeof invitationalMatchId>>;
  homeSchoolId: MatchState["homeSchoolId"];
  awaySchoolId: MatchState["awaySchoolId"];
  userWon: boolean;
}): MatchState {
  return {
    id: input.id,
    seed: "phase51-invitational-test",
    bestOfSets: 3,
    phase: "match-complete",
    setIndex: 2,
    pointIndex: 0,
    homeSchoolId: input.homeSchoolId,
    awaySchoolId: input.awaySchoolId,
    homeSelection: {
      rotation: [],
      liberoPlayerId: null,
      benchPlayerIds: [],
      servingOrderPlayerIds: [],
      substitutionPolicy: {
        starterLockPlayerIds: [],
        allowFatigueBenching: true,
        allowInjuryBenching: true,
        automaticSubstitutions: true,
        automaticSetChanges: true,
      },
    },
    awaySelection: {
      rotation: [],
      liberoPlayerId: null,
      benchPlayerIds: [],
      servingOrderPlayerIds: [],
      substitutionPolicy: {
        starterLockPlayerIds: [],
        allowFatigueBenching: true,
        allowInjuryBenching: true,
        automaticSubstitutions: true,
        automaticSetChanges: true,
      },
    },
    homeSetsWon: input.userWon ? 2 : 0,
    awaySetsWon: input.userWon ? 0 : 2,
    currentSet: null,
    completedSets: [],
    events: [],
    runtime: null,
  };
}

describe("Phase51 invitational cup", () => {
  it("creates a bounded four-school tournament with a deterministic semifinal opponent", () => {
    const state = readyState();
    const cup = createInvitationalCup(state);

    expect(cup).not.toBeNull();
    expect(cup?.entrantSchoolIds).toHaveLength(4);
    expect(new Set(cup?.entrantSchoolIds).size).toBe(4);
    expect(cup?.entrantSchoolIds[0]).toBe(state.userSchoolId);
    expect(cup?.currentRound).toBe("semifinal");
    expect(cup?.currentOpponentSchoolId).not.toBeNull();
    expect(cup?.finalOpponentSchoolId).not.toBe(
      cup?.currentOpponentSchoolId,
    );
  });

  it("moves a semifinal winner to the final without growing tournament history", () => {
    const state = readyState();
    const cup = createInvitationalCup(state)!;
    state.schoolManagement.invitationalCup = cup;
    const id = invitationalMatchId(cup)!;
    const match = completedMatch({
      id,
      homeSchoolId: state.userSchoolId,
      awaySchoolId: cup.currentOpponentSchoolId!,
      userWon: true,
    });

    const next = recordInvitationalOutcome(state, match);
    const active = activeInvitationalCup(next);

    expect(active?.currentRound).toBe("final");
    expect(active?.currentOpponentSchoolId).toBe(cup.finalOpponentSchoolId);
    expect(active?.championSchoolId).toBeNull();
    expect(next.schools[next.userSchoolId]!.reputationPoints).toBe(908);
  });

  it("awards one invitational title only when the user wins the final", () => {
    const state = readyState();
    const cup = createInvitationalCup(state)!;
    state.schoolManagement.invitationalCup = {
      ...cup,
      currentRound: "final",
      currentOpponentSchoolId: cup.finalOpponentSchoolId,
    };
    const finalCup = state.schoolManagement.invitationalCup;
    const id = invitationalMatchId(finalCup)!;
    const match = completedMatch({
      id,
      homeSchoolId: state.userSchoolId,
      awaySchoolId: finalCup.currentOpponentSchoolId!,
      userWon: true,
    });

    const next = recordInvitationalOutcome(state, match);
    expect(next.schoolManagement.invitationalCup).toMatchObject({
      currentRound: null,
      championSchoolId: state.userSchoolId,
      userEliminated: false,
    });
    expect(next.schools[next.userSchoolId]!.history.invitationalTitles).toBe(1);
    expect(next.schools[next.userSchoolId]!.history.nationalTitles).toBe(1);
  });

  it("ends the tournament when the user loses the semifinal", () => {
    const state = readyState();
    const cup = createInvitationalCup(state)!;
    state.schoolManagement.invitationalCup = cup;
    const id = invitationalMatchId(cup)!;
    const match = completedMatch({
      id,
      homeSchoolId: state.userSchoolId,
      awaySchoolId: cup.currentOpponentSchoolId!,
      userWon: false,
    });

    const next = recordInvitationalOutcome(state, match);
    expect(next.schoolManagement.invitationalCup).toMatchObject({
      currentRound: null,
      currentOpponentSchoolId: null,
      userEliminated: true,
    });
    expect(
      next.schools[next.userSchoolId]!.history.invitationalTitles ?? 0,
    ).toBe(0);
  });
});
