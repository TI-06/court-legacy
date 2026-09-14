import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { HistoricalMatchSummary } from "../../../../src/domain/model/GameState";
import { matchId } from "../../../../src/domain/model/identifiers";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { rivalryKey } from "../../../../src/domain/world/rivalWorldProgression";
import {
  buildPreMatchRivalryPresentation,
  buildPreMatchRivalryPresentationFromSelection,
  resolveLocalOpponentSchoolId,
} from "../../../../src/features/match/rivalryPresentation";

describe("Phase20 pre-match rivalry presentation", () => {
  it("stays hidden for a first-time neutral opponent", () => {
    const state = createDemoGame();
    const opponent = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;

    expect(buildPreMatchRivalryPresentation(state, opponent.id)).toBeNull();
  });

  it("shows lifetime record, previous loss, revenge, and destiny rival context", () => {
    const state = createDemoGame();
    const opponent = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;
    const add = (id: string, userWon: boolean) => {
      const summary: HistoricalMatchSummary = {
        matchId: matchId(id),
        date: id === "history-1" ? "2026-05-01" : "2026-06-01",
        homeSchoolId: state.userSchoolId,
        awaySchoolId: opponent.id,
        winnerSchoolId: userWon ? state.userSchoolId : opponent.id,
        homeSetsWon: userWon ? 2 : 1,
        awaySetsWon: userWon ? 1 : 2,
        tournamentId: null,
      };
      state.history.matches.push(summary);
    };
    add("history-1", true);
    add("history-2", false);
    state.world.destinyRivalSchoolId = opponent.id;
    state.world.rivalryScores[rivalryKey(state.userSchoolId, opponent.id)] = 80;

    expect(buildPreMatchRivalryPresentation(state, opponent.id)).toEqual({
      headline: `${opponent.shortName}との因縁`,
      recordLabel: "通算 1勝1敗",
      previousResultLabel: "前回 敗戦 1-2",
      chips: ["宿敵", "雪辱戦"],
    });
  });

  it("resolves a local PVE opponent from the selection and rejects non-local selections", () => {
    const state = createDemoGame();
    const opponent = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;
    const selection = autoSelectTeam({ state, schoolId: opponent.id });

    expect(resolveLocalOpponentSchoolId(state, selection)).toBe(opponent.id);
    expect(
      buildPreMatchRivalryPresentationFromSelection(state, selection),
    ).toBeNull();

    const remote = structuredClone(selection);
    remote.rotation = remote.rotation.map((assignment) => ({
      ...assignment,
      playerId: `remote:${assignment.playerId}` as typeof assignment.playerId,
    }));
    remote.benchPlayerIds = remote.benchPlayerIds.map(
      (playerId) => `remote:${playerId}` as typeof playerId,
    );
    remote.servingOrderPlayerIds = remote.servingOrderPlayerIds.map(
      (playerId) => `remote:${playerId}` as typeof playerId,
    ) as typeof remote.servingOrderPlayerIds;
    remote.liberoPlayerId = remote.liberoPlayerId
      ? (`remote:${remote.liberoPlayerId}` as typeof remote.liberoPlayerId)
      : null;

    expect(resolveLocalOpponentSchoolId(state, remote)).toBeNull();
  });
});
