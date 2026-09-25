import { createDemoGame } from "../../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import type {
  MatchEvent,
  MatchState,
} from "../../../../src/domain/model/Match";
import {
  presentEventSpecialAbilities,
  presentPlayerSpecialAbilities,
} from "../../../../src/features/match/specialAbilityPresentation";

function matchEvent(overrides: Partial<MatchEvent> = {}): MatchEvent {
  return {
    sequence: 1,
    type: "serve",
    setNumber: 1,
    homeScore: 0,
    awayScore: 0,
    actorPlayerId: null,
    targetPlayerId: null,
    winnerSchoolId: null,
    detailCode: "serve.in-play",
    ...overrides,
  };
}

function matchState(
  state: ReturnType<typeof createDemoGame>,
  overrides: Partial<MatchState> = {},
): MatchState {
  const opponent = Object.values(state.schools).find(
    (school) => school.id !== state.userSchoolId,
  )!;
  return {
    id: "match-special-ability-test" as MatchState["id"],
    homeSchoolId: state.userSchoolId,
    awaySchoolId: opponent.id,
    homeSelection: autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    }),
    awaySelection: autoSelectTeam({
      state,
      schoolId: opponent.id,
    }),
    bestOfSets: 3,
    phase: "set-in-progress",
    currentSetNumber: 1,
    homeSetsWon: 0,
    awaySetsWon: 0,
    sets: [],
    servingSchoolId: state.userSchoolId,
    pendingCoachCommandForSchoolId: null,
    eventLog: [],
    randomSeed: "special-ability-presentation",
    randomCursor: 0,
    ...overrides,
  };
}

describe("special ability match presentation", () => {
  it("prioritizes gold, elite, and negative abilities in compact player badges", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = {
      ...state.players[playerId]!,
      specialAbilityIds: [
        "serve_stable",
        "serve_unstable",
        "elite_serve_craftsman",
        "gold_serve_king",
      ],
    };

    expect(
      presentPlayerSpecialAbilities(player, 3).map((ability) => ability.id),
    ).toEqual(["gold_serve_king", "elite_serve_craftsman", "serve_unstable"]);
  });

  it("shows conditional abilities only when their real match condition is active", () => {
    const state = createDemoGame();
    const ownPlayerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.players[ownPlayerId] = {
      ...state.players[ownPlayerId]!,
      specialAbilityIds: ["serve_stable", "serve_late_game", "mental_clutch"],
    };
    const match = matchState(state);

    const earlyServe = presentEventSpecialAbilities(
      state,
      match,
      matchEvent({
        actorPlayerId: ownPlayerId,
        homeScore: 4,
        awayScore: 3,
      }),
    );
    const clutchServe = presentEventSpecialAbilities(
      state,
      match,
      matchEvent({
        actorPlayerId: ownPlayerId,
        homeScore: 23,
        awayScore: 22,
      }),
    );

    expect(earlyServe.map((ability) => ability.id)).toContain("serve_stable");
    expect(earlyServe.map((ability) => ability.id)).not.toContain(
      "serve_late_game",
    );
    expect(earlyServe.map((ability) => ability.id)).not.toContain(
      "mental_clutch",
    );

    const clutchIds = clutchServe.map((ability) => ability.id);
    expect(clutchIds).toContain("serve_stable");
    expect(clutchIds).toContain("serve_late_game");
    expect(clutchIds).toContain("mental_clutch");
  });

  it("shows only own-player abilities relevant to the current volleyball action", () => {
    const state = createDemoGame();
    const ownPlayerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const opponent = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;
    const opponentPlayerId = opponent.playerIds[0]!;
    state.players[ownPlayerId] = {
      ...state.players[ownPlayerId]!,
      specialAbilityIds: [
        "gold_serve_king",
        "serve_stable",
        "receive_serve",
        "growth_motivation",
      ],
    };
    state.players[opponentPlayerId] = {
      ...state.players[opponentPlayerId]!,
      specialAbilityIds: ["gold_serve_king"],
    };

    const match = matchState(state);
    const ownServe = presentEventSpecialAbilities(
      state,
      match,
      matchEvent({ actorPlayerId: ownPlayerId }),
    );
    const opponentServe = presentEventSpecialAbilities(
      state,
      match,
      matchEvent({ actorPlayerId: opponentPlayerId }),
    );
    const ownPoint = presentEventSpecialAbilities(
      state,
      match,
      matchEvent({ actorPlayerId: ownPlayerId, type: "point" }),
    );

    expect(ownServe.map((ability) => ability.id)).toEqual([
      "gold_serve_king",
      "serve_stable",
    ]);
    expect(opponentServe).toEqual([]);
    expect(ownPoint).toEqual([]);
  });
});
