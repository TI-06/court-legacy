import { createDemoGame } from "../../../../src/app/createDemoGame";
import type {
  GameState,
  PlayerDevelopmentWeek,
} from "../../../../src/domain/model/GameState";
import { calculatePlayerDisplayPower } from "../../../../src/domain/selectors/playerPresentation";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import {
  selectPlayerHubRoster,
  summarizePlayerGrowth,
  type PlayerHubFilter,
  type PlayerHubSort,
} from "../../../../src/features/team/playerHubRoster";

function developmentWeek(
  gameDate: GameState["date"],
  weekOfYear: number,
  players: PlayerDevelopmentWeek["players"],
): PlayerDevelopmentWeek {
  return {
    gameDate,
    academicYearIndex: 0,
    weekOfYear,
    trainingMenuId: "training.balanced",
    players,
  };
}

function rosterIds(filter: PlayerHubFilter, sort: PlayerHubSort = "power") {
  const state = createDemoGame();
  const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });
  return selectPlayerHubRoster({ state, selection, filter, sort }).map(
    (item) => item.player.id,
  );
}

describe("Player Hub roster selectors", () => {
  it("aggregates only persisted player logs and distinguishes no history from zero growth", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const otherPlayerId = school.playerIds[1]!;

    state.history.playerDevelopmentWeeks = [
      developmentWeek("2026-04-01", 1, [
        { playerId, totalAbilityGrowth: 0, abilityChanges: {} },
      ]),
      developmentWeek("2026-04-08", 2, [
        { playerId, totalAbilityGrowth: 3, abilityChanges: { spike: 3 } },
      ]),
    ];

    expect(summarizePlayerGrowth(state, playerId)).toEqual({
      fourWeekGrowth: 3,
      twelveWeekGrowth: 3,
      observedWeeks4: 2,
      observedWeeks12: 2,
      trend12: [
        { gameDate: "2026-04-01", totalAbilityGrowth: 0 },
        { gameDate: "2026-04-08", totalAbilityGrowth: 3 },
      ],
    });
    expect(summarizePlayerGrowth(state, otherPlayerId)).toEqual({
      fourWeekGrowth: null,
      twelveWeekGrowth: null,
      observedWeeks4: 0,
      observedWeeks12: 0,
      trend12: [],
    });
  });

  it("uses only the newest 4 and 12 persisted weeks and preserves real-log order", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.history.playerDevelopmentWeeks = Array.from(
      { length: 13 },
      (_, index) =>
        developmentWeek(
          `2026-06-${String(index + 1).padStart(2, "0")}` as GameState["date"],
          index + 1,
          [
            {
              playerId,
              totalAbilityGrowth: index + 1,
              abilityChanges: { spike: index + 1 },
            },
          ],
        ),
    );

    const summary = summarizePlayerGrowth(state, playerId);
    expect(summary.fourWeekGrowth).toBe(10 + 11 + 12 + 13);
    expect(summary.twelveWeekGrowth).toBe(
      Array.from({ length: 12 }, (_, index) => index + 2).reduce(
        (sum, value) => sum + value,
        0,
      ),
    );
    expect(summary.observedWeeks4).toBe(4);
    expect(summary.observedWeeks12).toBe(12);
    expect(summary.trend12[0]?.totalAbilityGrowth).toBe(2);
    expect(summary.trend12.at(-1)?.totalAbilityGrowth).toBe(13);
  });

  it.each([
    ["grade-1", 1],
    ["grade-2", 2],
    ["grade-3", 3],
  ] as const)("filters %s", (filter, grade) => {
    const state = createDemoGame();
    const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });
    const result = selectPlayerHubRoster({
      state,
      selection,
      filter,
      sort: "power",
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.player.grade === grade)).toBe(true);
  });

  it.each(["OH", "MB", "OP", "S", "L"] as const)(
    "filters position-%s",
    (position) => {
      const state = createDemoGame();
      const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });
      const result = selectPlayerHubRoster({
        state,
        selection,
        filter: `position-${position}`,
        sort: "power",
      });

      expect(result.length).toBeGreaterThan(0);
      expect(
        result.every((item) => item.player.preferredPosition === position),
      ).toBe(true);
    },
  );

  it("filters starters and bench from the current selection", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });
    const starterIds = selectPlayerHubRoster({
      state,
      selection,
      filter: "starter",
      sort: "power",
    })
      .map((item) => item.player.id)
      .sort();
    const expectedStarters = [
      ...selection.rotation.map((item) => item.playerId),
      ...(selection.liberoPlayerId ? [selection.liberoPlayerId] : []),
    ].sort();
    const benchIds = selectPlayerHubRoster({
      state,
      selection,
      filter: "bench",
      sort: "power",
    })
      .map((item) => item.player.id)
      .sort();

    expect(starterIds).toEqual([...new Set(expectedStarters)].sort());
    expect(benchIds).toEqual([...selection.benchPlayerIds].sort());
  });

  it("filters explicit priorities and injured players", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const priorityIds = school.playerIds.slice(0, 2);
    const injuredId = school.playerIds[2]!;
    state.teamPlanning.developmentPriorityPlayerIds = [...priorityIds];
    state.players[injuredId]!.injury = {
      injuryId: "injury-test",
      severity: "minor",
      remainingWeeks: 1,
      recurrenceRisk: 0,
    };
    const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });

    expect(
      selectPlayerHubRoster({
        state,
        selection,
        filter: "priority",
        sort: "power",
      })
        .map((item) => item.player.id)
        .sort(),
    ).toEqual([...priorityIds].sort());
    expect(
      selectPlayerHubRoster({
        state,
        selection,
        filter: "injured",
        sort: "power",
      }).map((item) => item.player.id),
    ).toContain(injuredId);
  });

  it("sorts 4-week growth as positive then real zero then no history", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const positiveId = school.playerIds[0]!;
    const zeroId = school.playerIds[1]!;
    const noHistoryId = school.playerIds[2]!;
    state.history.playerDevelopmentWeeks = [
      developmentWeek("2026-04-01", 1, [
        { playerId: positiveId, totalAbilityGrowth: 5, abilityChanges: {} },
        { playerId: zeroId, totalAbilityGrowth: 0, abilityChanges: {} },
      ]),
    ];
    const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });
    const result = selectPlayerHubRoster({
      state,
      selection,
      filter: "all",
      sort: "growth-4w",
    });
    const ids = result.map((item) => item.player.id);

    expect(ids.indexOf(positiveId)).toBeLessThan(ids.indexOf(zeroId));
    expect(ids.indexOf(zeroId)).toBeLessThan(ids.indexOf(noHistoryId));
    expect(
      result.find((item) => item.player.id === positiveId)?.growth
        .fourWeekGrowth,
    ).toBe(5);
    expect(
      result.find((item) => item.player.id === zeroId)?.growth.fourWeekGrowth,
    ).toBe(0);
    expect(
      result.find((item) => item.player.id === noHistoryId)?.growth
        .fourWeekGrowth,
    ).toBeNull();
  });

  it("sorts power, potential, condition and grade deterministically", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const ids = school.playerIds.slice(0, 3);
    state.players[ids[0]!]!.potential = 50;
    state.players[ids[1]!]!.potential = 95;
    delete state.players[ids[2]!]!.potential;
    state.players[ids[0]!]!.condition = 10;
    state.players[ids[1]!]!.condition = 90;
    state.players[ids[2]!]!.condition = 50;
    const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });

    const powerResult = selectPlayerHubRoster({
      state,
      selection,
      filter: "all",
      sort: "power",
    });
    const expectedPowerFirst = school.playerIds
      .map((id) => state.players[id]!)
      .sort((left, right) => {
        const delta =
          calculatePlayerDisplayPower(right) -
          calculatePlayerDisplayPower(left);
        return delta || left.id.localeCompare(right.id);
      })[0]!.id;
    expect(powerResult[0]!.player.id).toBe(expectedPowerFirst);

    const potentialResult = selectPlayerHubRoster({
      state,
      selection,
      filter: "all",
      sort: "potential",
    });
    expect(
      potentialResult.findIndex((item) => item.player.id === ids[1]),
    ).toBeLessThan(
      potentialResult.findIndex((item) => item.player.id === ids[0]),
    );
    expect(
      potentialResult.findIndex((item) => item.player.id === ids[2]),
    ).toBeGreaterThan(
      potentialResult.findIndex((item) => item.player.id === ids[0]),
    );

    const conditionResult = selectPlayerHubRoster({
      state,
      selection,
      filter: "all",
      sort: "condition",
    });
    expect(
      conditionResult.findIndex((item) => item.player.id === ids[1]),
    ).toBeLessThan(
      conditionResult.findIndex((item) => item.player.id === ids[2]),
    );
    expect(
      conditionResult.findIndex((item) => item.player.id === ids[2]),
    ).toBeLessThan(
      conditionResult.findIndex((item) => item.player.id === ids[0]),
    );

    const gradeResult = selectPlayerHubRoster({
      state,
      selection,
      filter: "all",
      sort: "grade",
    });
    for (let index = 1; index < gradeResult.length; index += 1) {
      expect(gradeResult[index - 1]!.player.grade).toBeGreaterThanOrEqual(
        gradeResult[index]!.player.grade,
      );
    }
  });

  it("keeps all-filter roster membership stable", () => {
    const allIds = rosterIds("all").sort();
    const state = createDemoGame();
    expect(allIds).toEqual(
      [...state.schools[state.userSchoolId]!.playerIds].sort(),
    );
  });
});
