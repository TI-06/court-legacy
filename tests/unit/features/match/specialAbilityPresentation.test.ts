import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { MatchEvent } from "../../../../src/domain/model/Match";
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

    const ownServe = presentEventSpecialAbilities(
      state,
      matchEvent({ actorPlayerId: ownPlayerId }),
    );
    const opponentServe = presentEventSpecialAbilities(
      state,
      matchEvent({ actorPlayerId: opponentPlayerId }),
    );
    const ownPoint = presentEventSpecialAbilities(
      state,
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
