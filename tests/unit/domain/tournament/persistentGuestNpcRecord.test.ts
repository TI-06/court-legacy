import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import type { GameState } from "../../../../src/domain/model/GameState";
import {
  advanceOfficialTournamentsThroughWeek,
  completeTournamentMatch,
  findDueUserOfficialMatch,
} from "../../../../src/domain/tournament/progressOfficialTournaments";

function createState(): GameState {
  return createInitialGame({
    seed: "phase6-persistent-guest-npc",
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高橋 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });
}

function atWeek(state: GameState, weekOfYear: number): GameState {
  return {
    ...state,
    calendar: {
      ...state.calendar,
      weekOfYear,
    },
  };
}

function eliminateUserFromInterhigh(state: GameState): GameState {
  let next = advanceOfficialTournamentsThroughWeek(atWeek(state, 9));
  const due = findDueUserOfficialMatch(next);
  if (!due || due.circuit !== "interhigh" || due.level !== "prefectural") {
    throw new Error("expected Interhigh prefectural opening match");
  }

  const userEntrantId = due.userEntrant.entrantId;
  const opponentEntrantId =
    due.match.homeEntrantId === userEntrantId
      ? due.match.awayEntrantId
      : due.match.homeEntrantId;
  if (!opponentEntrantId) {
    throw new Error("expected opening opponent");
  }
  const userIsHome = due.match.homeEntrantId === userEntrantId;

  next = completeTournamentMatch({
    state: next,
    circuit: due.circuit,
    level: due.level,
    matchId: due.match.id,
    winnerEntrantId: opponentEntrantId,
    homeSetsWon: userIsHome ? 0 : 2,
    awaySetsWon: userIsHome ? 2 : 0,
  });

  return advanceOfficialTournamentsThroughWeek(atWeek(next, 12));
}

function nationalRepresentative(state: GameState) {
  const stage = state.officialSeason.interhigh.national;
  if (!stage) {
    throw new Error("expected Interhigh national stage");
  }
  const entrant = stage.entrants.find(
    (candidate) => candidate.source === "world-school",
  );
  if (!entrant || entrant.source !== "world-school") {
    throw new Error("expected one persistent national representative");
  }
  return { stage, entrant };
}

describe("persistent school vs guest NPC official matches", () => {
  it("increments the persistent representative official record", () => {
    const qualified = eliminateUserFromInterhigh(createState());
    const { entrant } = nationalRepresentative(qualified);
    const before = qualified.schools[entrant.schoolId]!.history;

    const progressed = advanceOfficialTournamentsThroughWeek(atWeek(qualified, 16));
    const after = progressed.schools[entrant.schoolId]!.history;

    expect(after.officialWins + after.officialLosses).toBe(
      before.officialWins + before.officialLosses + 1,
    );
  });

  it("keeps a readable immutable history entry without persisting the guest school", () => {
    const qualified = eliminateUserFromInterhigh(createState());
    const { stage, entrant } = nationalRepresentative(qualified);
    const historyLength = qualified.history.matches.length;

    const progressed = advanceOfficialTournamentsThroughWeek(atWeek(qualified, 16));
    const nationalHistory = progressed.history.matches.slice(historyLength).filter(
      (match) => match.tournamentId === stage.tournamentId,
    );

    expect(nationalHistory).toHaveLength(1);
    expect([
      nationalHistory[0]?.homeDisplayName,
      nationalHistory[0]?.awayDisplayName,
    ]).toContain(entrant.displayName);
    expect(nationalHistory[0]?.homeDisplayName).toBeTruthy();
    expect(nationalHistory[0]?.awayDisplayName).toBeTruthy();
    expect(Object.keys(progressed.schools).some((id) => id.includes("guest"))).toBe(
      false,
    );
    expect(Object.keys(progressed.players).some((id) => id.includes("guest"))).toBe(
      false,
    );
  });
});
