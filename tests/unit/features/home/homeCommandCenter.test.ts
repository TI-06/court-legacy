import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { markWeeklyActionCompleted } from "../../../../src/domain/calendar/weekProgression";
import type { GameState } from "../../../../src/domain/model/GameState";
import type { TrainingResultNotification } from "../../../../src/domain/notifications/gameNotifications";
import { advanceOfficialTournamentsThroughWeek } from "../../../../src/domain/tournament/progressOfficialTournaments";
import { selectHomeCommandCenter } from "../../../../src/features/home/homeCommandCenter";

function select(state = createDemoGame(), homeStrength = 8120) {
  return selectHomeCommandCenter({ state, data: gameData, homeStrength });
}

function otherSchool(state: GameState) {
  const school = Object.values(state.schools).find(
    (candidate) => candidate.id !== state.userSchoolId,
  );
  if (!school) throw new Error("opponent fixture missing");
  return school;
}

function incomingOfferState() {
  const state = createDemoGame();
  const opponent = otherSchool(state);
  state.weeklySchedule.practiceMatch = {
    ...state.weeklySchedule.practiceMatch,
    incomingOffer: {
      schoolId: opponent.id,
      growthRating: 4,
      loadRating: 3,
    },
    scheduledOpponentId: null,
    scheduledBy: null,
  };
  return { state, opponent };
}

function trainingNotification(
  state: GameState,
  growthByPlayer: number[],
  read = false,
): TrainingResultNotification {
  const playerIds = state.schools[state.userSchoolId]!.playerIds;
  const players = growthByPlayer.map((growth, index) => {
    const player = state.players[playerIds[index]!]!;
    return {
      playerId: player.id,
      displayName: `${player.lastName} ${player.firstName}`,
      grade: player.grade,
      preferredPosition: player.preferredPosition,
      totalAbilityGrowth: growth,
      fatigueChange: 0,
      conditionChange: 0,
      trustChange: 0,
      injured: false,
      abilityChanges: {},
    };
  });

  return {
    id: "training-result:phase13",
    type: "training-result",
    createdGameDate: state.date,
    academicYearIndex: state.yearIndex,
    weekOfYear: state.calendar.weekOfYear,
    readAtGameDate: read ? state.date : null,
    payload: {
      teamTrainingMenuName: "スパイク練習",
      totalAbilityGrowth: players.reduce(
        (sum, player) => sum + player.totalAbilityGrowth,
        0,
      ),
      totalFatigueChange: 0,
      injuredCount: 0,
      players,
    },
  };
}

describe("selectHomeCommandCenter", () => {
  it("builds the weekly summary without inventing a prefectural or national rank", () => {
    const model = select();

    expect(model.summary.schoolName).toBe("青葉");
    expect(model.summary.strength).toBe(8120);
    expect(model.summary.weekLabel).toBe("第1週");
    expect(JSON.stringify(model.summary)).not.toMatch(/県.*位|全国.*位/);
  });

  it("warns only when an unanswered incoming practice offer exists", () => {
    const { state } = incomingOfferState();

    expect(select(state).advance).toEqual({
      requiresConfirmation: true,
      reason: "practice-offer",
    });

    state.weeklySchedule.practiceMatch.incomingOffer = null;
    expect(select(state).advance).toEqual({
      requiresConfirmation: false,
      reason: null,
    });
  });

  it("keeps a future official event in the summary instead of creating a critical task", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    const model = select(state);

    expect(model.summary.official).not.toBeNull();
    expect(model.summary.official?.due).toBe(false);
    expect(
      model.tasks.some(
        (task) => task.category === "official" && task.priority === "critical",
      ),
    ).toBe(false);
  });

  it("creates a critical official-match task when an official match is due", () => {
    const initial = createDemoGame();
    let state: GameState = {
      ...initial,
      calendar: { ...initial.calendar, weekOfYear: 9 },
    };
    state = advanceOfficialTournamentsThroughWeek(state);
    state.weeklySchedule.practiceMatch.incomingOffer = null;

    const model = select(state);
    const official = model.tasks.find((task) => task.category === "official");

    expect(model.summary.official?.due).toBe(true);
    expect(official).toMatchObject({
      priority: "critical",
      action: { target: "start-week-match" },
    });
  });

  it("creates a practice task for a scheduled practice match", () => {
    const state = createDemoGame();
    const opponent = otherSchool(state);
    state.weeklySchedule.practiceMatch = {
      ...state.weeklySchedule.practiceMatch,
      incomingOffer: null,
      scheduledOpponentId: opponent.id,
      scheduledBy: "outgoing",
    };

    const practice = select(state).tasks.find(
      (task) => task.category === "practice",
    );

    expect(practice).toMatchObject({
      kind: "action",
      action: { target: "practice" },
    });
    expect(practice?.detail).toContain(opponent.shortName);
  });

  it("shows training as configured until completed and as subdued complete afterward", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;

    let training = select(state).tasks.find(
      (task) => task.category === "training",
    );
    expect(training).toMatchObject({
      priority: "normal",
      action: { target: "team" },
      complete: false,
    });
    expect(training?.detail).toContain("設定済み");

    const completed = markWeeklyActionCompleted(state, "training");
    training = select(completed).tasks.find(
      (task) => task.category === "training",
    );
    expect(training).toMatchObject({ priority: "complete", complete: true });
    expect(training?.detail).toContain("完了");
  });

  it("sorts player concerns by severity, grade and player id and limits them to two", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    const ids = state.schools[state.userSchoolId]!.playerIds.slice(0, 3);
    const first = state.players[ids[0]!]!;
    const second = state.players[ids[1]!]!;
    const third = state.players[ids[2]!]!;
    first.grade = 1;
    second.grade = 2;
    third.grade = 3;
    state.teamDynamics.playerConcerns = {
      [first.id]: [{ code: "playing-time", severity: 2 }],
      [second.id]: [{ code: "role-mismatch", severity: 3 }],
      [third.id]: [{ code: "team-slump", severity: 3 }],
    };

    const concerns = select(state).tasks.filter(
      (task) => task.category === "player",
    );

    expect(concerns).toHaveLength(2);
    expect(concerns[0]?.detail).toContain(`${third.lastName} ${third.firstName}`);
    expect(concerns[1]?.detail).toContain(`${second.lastName} ${second.firstName}`);
    expect(concerns.every((task) => task.priority === "attention")).toBe(true);
  });

  it("renders one injured player directly and aggregates multiple injured players", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    const ids = state.schools[state.userSchoolId]!.playerIds.slice(0, 2);
    const first = state.players[ids[0]!]!;
    const second = state.players[ids[1]!]!;
    first.injury = {
      injuryId: "injury.phase13",
      severity: "minor",
      remainingWeeks: 2,
      recurrenceRisk: 10,
    };

    let injury = select(state).tasks.find((task) => task.category === "injury");
    expect(injury?.detail).toContain(`${first.lastName} ${first.firstName}`);
    expect(injury?.detail).toContain("あと2週");

    second.injury = {
      injuryId: "injury.phase13-2",
      severity: "moderate",
      remainingWeeks: 4,
      recurrenceRisk: 20,
    };
    injury = select(state).tasks.find((task) => task.category === "injury");
    expect(injury?.title).toBe("怪我人 2名");
    expect(injury).toMatchObject({ action: { target: "team" } });
  });

  it("aggregates affordable facility upgrades into one school-management task", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    const facility = select(state).tasks.find(
      (task) => task.category === "facility",
    );

    expect(facility?.title).toMatch(/強化可能な設備 \d+件/);
    expect(facility).toMatchObject({
      action: { target: "school", view: "facilities" },
    });
  });

  it.each([1, 8])("recommends an annual coach in academic week %i", (week) => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    state.calendar.weekOfYear = week;
    state.schoolManagement.assistantCoach = null;

    expect(select(state).tasks.some((task) => task.category === "staff")).toBe(
      true,
    );
  });

  it("does not recommend an annual coach after week 8 or with a current-year contract", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    state.calendar.weekOfYear = 9;
    state.schoolManagement.assistantCoach = null;
    expect(select(state).tasks.some((task) => task.category === "staff")).toBe(
      false,
    );

    state.calendar.weekOfYear = 1;
    state.schoolManagement.assistantCoach = {
      rank: "beginner",
      specialty: null,
      contractYearIndex: state.yearIndex,
    };
    expect(select(state).tasks.some((task) => task.category === "staff")).toBe(
      false,
    );
  });

  it("shows the newest training result and significant growth at the >=5 threshold", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    state.notifications.items = [trainingNotification(state, [5, 4])];

    const model = select(state);
    expect(model.news[0]).toMatchObject({ kind: "training-result" });
    expect(model.news.some((item) => item.kind === "growth")).toBe(true);
  });

  it("selects the highest-growth player and breaks growth ties by player id", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    const ids = state.schools[state.userSchoolId]!.playerIds.slice(0, 2);
    const firstId = [ids[0]!, ids[1]!].sort()[0]!;
    state.notifications.items = [trainingNotification(state, [6, 6])];

    const growth = select(state).news.find((item) => item.kind === "growth");
    expect(growth).toMatchObject({ kind: "growth", playerId: firstId });
  });

  it("uses the latest user-school match and persisted display names when available", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    const opponent = otherSchool(state);
    state.history.matches = [
      {
        matchId: "match-phase13-old" as never,
        date: "2026-04-02" as never,
        homeSchoolId: state.userSchoolId,
        awaySchoolId: opponent.id,
        winnerSchoolId: opponent.id,
        homeSetsWon: 0,
        awaySetsWon: 2,
        tournamentId: null,
      },
      {
        matchId: "match-phase13-new" as never,
        date: "2026-04-09" as never,
        homeSchoolId: opponent.id,
        awaySchoolId: state.userSchoolId,
        winnerSchoolId: state.userSchoolId,
        homeSetsWon: 1,
        awaySetsWon: 2,
        tournamentId: null,
        homeDisplayName: "保存済み相手校",
        awayDisplayName: "青葉高校",
      },
    ];

    const news = select(state).news.find((item) => item.kind === "match");
    expect(news?.detail).toContain("保存済み相手校");
    expect(news?.detail).toContain("2-1");
  });

  it("emits cohesion news only when the absolute change reaches 3", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    state.teamDynamics.previousCohesion = 70;
    state.teamDynamics.cohesion = 72;
    expect(select(state).news.some((item) => item.kind === "cohesion")).toBe(
      false,
    );

    state.teamDynamics.cohesion = 73;
    expect(select(state).news.some((item) => item.kind === "cohesion")).toBe(
      true,
    );
  });

  it("orders critical before attention before normal before complete and caps tasks/news deterministically", () => {
    const { state } = incomingOfferState();
    const ids = state.schools[state.userSchoolId]!.playerIds.slice(0, 3);
    for (const id of ids) {
      state.teamDynamics.playerConcerns[id] = [
        { code: "playing-time", severity: 3 },
      ];
    }
    state.notifications.items = [trainingNotification(state, [8, 7, 6])];
    state.teamDynamics.previousCohesion = 60;
    state.teamDynamics.cohesion = 70;

    const first = select(state);
    const second = select(state);
    const weight = { critical: 0, attention: 1, normal: 2, complete: 3 };

    expect(first.tasks).toHaveLength(5);
    expect(first.news.length).toBeLessThanOrEqual(3);
    expect(first.tasks.map((task) => weight[task.priority])).toEqual(
      [...first.tasks.map((task) => weight[task.priority])].sort(
        (left, right) => left - right,
      ),
    );
    expect(first.tasks.map((item) => item.id)).toEqual(
      second.tasks.map((item) => item.id),
    );
    expect(first.news.map((item) => item.id)).toEqual(
      second.news.map((item) => item.id),
    );
  });
});
