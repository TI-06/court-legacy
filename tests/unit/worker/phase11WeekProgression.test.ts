import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { isWeeklyActionCompleted } from "../../../src/domain/calendar/weekProgression";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import {
  advanceOfficialTournamentsThroughWeek,
  findDueUserOfficialMatch,
} from "../../../src/domain/tournament/progressOfficialTournaments";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { applyGameAction } from "../../../worker/game/applyGameAction";

function fixture(seed: string): CloudGameSnapshot {
  const state = createInitialGame({
    seed,
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高橋 監督",
    regionId: "region.chiba",
    uniform: { primary: "#17365D", secondary: "#FFFFFF", accent: "#D99B2B" },
  });
  return {
    userId: "phase11-user",
    schoolDbId: "00000000-0000-4000-8000-000000000111",
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}
function schedulePractice(game: CloudGameSnapshot) {
  const opponent = Object.values(game.state.schools).find(
    (s) => s.id !== game.state.userSchoolId,
  );
  if (!opponent) throw new Error("practice opponent fixture missing");
  game.state.weeklySchedule.practiceMatch.scheduledOpponentId = opponent.id;
  game.state.weeklySchedule.practiceMatch.scheduledBy = "outgoing";
}
describe("Phase11 week progression", () => {
  it("presents scheduled practice before advancing, then advances without replay", () => {
    const game = fixture("phase11-practice");
    schedulePractice(game);
    const first = applyGameAction(game, { type: "advance-week" });
    expect(first.state.date).toBe(game.state.date);
    expect(isWeeklyActionCompleted(first.state, "training")).toBe(true);
    expect(isWeeklyActionCompleted(first.state, "practice-match")).toBe(true);
    expect(first.outcome).toMatchObject({
      weekAdvanced: false,
      pendingMatchPresentation: { kind: "practice" },
    });
    const matchId = first.state.history.matches.at(-1)?.matchId;
    const second = applyGameAction(
      { ...game, state: first.state, teamSelection: first.teamSelection },
      { type: "advance-week" },
    );
    expect(second.state.date).not.toBe(game.state.date);
    expect(second.outcome).toMatchObject({
      weekAdvanced: true,
      pendingMatchPresentation: null,
    });
    expect(
      second.state.history.matches.filter((m) => m.matchId === matchId),
    ).toHaveLength(1);
  });
  it("presents official before practice and does not force practice afterward", () => {
    const base = fixture("phase11-official");
    const state = advanceOfficialTournamentsThroughWeek({
      ...base.state,
      calendar: { ...base.state.calendar, weekOfYear: 9 },
    });
    expect(findDueUserOfficialMatch(state)).not.toBeNull();
    const game = {
      ...base,
      state,
      teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
    };
    schedulePractice(game);
    const first = applyGameAction(game, { type: "advance-week" });
    expect(first.state.date).toBe(game.state.date);
    expect(first.outcome).toMatchObject({
      weekAdvanced: false,
      pendingMatchPresentation: { kind: "official" },
    });
    expect(isWeeklyActionCompleted(first.state, "practice-match")).toBe(false);
    const userOfficialIds = first.state.history.matches
      .filter(
        (m) =>
          m.tournamentId !== null &&
          (m.homeSchoolId === state.userSchoolId ||
            m.awaySchoolId === state.userSchoolId),
      )
      .map((m) => m.matchId);
    const second = applyGameAction(
      { ...game, state: first.state, teamSelection: first.teamSelection },
      { type: "advance-week" },
    );
    expect(second.state.date).not.toBe(game.state.date);
    expect(second.outcome).toMatchObject({
      weekAdvanced: true,
      pendingMatchPresentation: null,
    });
    expect(isWeeklyActionCompleted(second.state, "practice-match")).toBe(false);
    const afterIds = second.state.history.matches
      .filter(
        (m) =>
          m.tournamentId !== null &&
          (m.homeSchoolId === state.userSchoolId ||
            m.awaySchoolId === state.userSchoolId),
      )
      .map((m) => m.matchId);
    expect(afterIds).toEqual(userOfficialIds);
  });
});
