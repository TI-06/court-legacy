import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import type {
  GameDate,
  PlayerId,
} from "../../../../src/domain/model/identifiers";

describe("academic year progression", () => {
  it("advances a normal week without changing the academic year", () => {
    const state = createDemoGame();

    const result = advanceGameWeek(state, gameData);

    expect(result.academicYearTransition).toBeNull();
    expect(result.state.yearIndex).toBe(1);
    expect(result.state.calendar.academicYear).toBe(1);
    expect(result.state.date).toBe("2026-04-08");
  });

  it("graduates third years, promotes returning players, and adds a new intake", () => {
    const state = createDemoGame();
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;
    state.world.nextGenerationalTalentYear = 2;
    const originalThirdYears = Object.values(state.players)
      .filter((player) => player.grade === 3)
      .map((player) => player.id);
    const originalSecondYears = Object.values(state.players)
      .filter((player) => player.grade === 2)
      .map((player) => player.id);
    const originalFirstYears = Object.values(state.players)
      .filter((player) => player.grade === 1)
      .map((player) => player.id);

    const result = advanceGameWeek(state, gameData);
    const transition = result.academicYearTransition;
    if (!transition) {
      throw new Error("academic year transition missing");
    }

    expect(result.state.date).toBe("2027-04-07");
    expect(result.state.yearIndex).toBe(2);
    expect(result.state.calendar.academicYear).toBe(2);
    expect(result.state.calendar.weekOfYear).toBe(1);
    expect(result.state.officialSeason.academicYear).toBe(2);
    expect(
      result.state.officialSeason.interhigh.prefectural.entrants,
    ).toHaveLength(16);
    expect(
      result.state.officialSeason.springHigh.prefectural.entrants,
    ).toHaveLength(16);
    expect(result.state.officialSeason.interhigh.national).toBeNull();
    expect(result.state.officialSeason.springHigh.national).toBeNull();
    expect(transition.graduatedPlayerIds).toHaveLength(
      originalThirdYears.length,
    );
    expect(result.state.history.graduates).toHaveLength(
      originalThirdYears.length,
    );

    const activePlayerIdList = Object.values(result.state.schools).flatMap(
      (school) => school.playerIds,
    );
    const activePlayerIds = new Set(activePlayerIdList);
    expect(activePlayerIds.size).toBe(activePlayerIdList.length);
    for (const playerId of originalThirdYears) {
      expect(activePlayerIds.has(playerId)).toBe(false);
    }
    for (const playerId of originalSecondYears) {
      expect(result.state.players[playerId]?.grade).toBe(3);
    }
    for (const playerId of originalFirstYears) {
      expect(result.state.players[playerId]?.grade).toBe(2);
    }

    for (const school of Object.values(result.state.schools)) {
      expect(school.playerIds.length).toBeGreaterThanOrEqual(12);
      expect(school.playerIds.length).toBeLessThanOrEqual(16);
      expect(school.history.seasons).toBe(1);
      expect(school.captainPlayerId).not.toBeNull();
      expect(school.playerIds).toContain(school.captainPlayerId);
      expect(result.state.players[school.captainPlayerId!]?.grade).toBe(3);
    }

    expect(transition.intakePlayerIds.length).toBeGreaterThanOrEqual(65);
    expect(transition.intakePlayerIds.length).toBeLessThanOrEqual(113);
    expect(transition.generationalTalentPlayerId).not.toBeNull();
    expect(result.state.world.generationalTalentPlayerIds).toContain(
      transition.generationalTalentPlayerId,
    );
    expect(result.state.randomCursor).toBeGreaterThan(state.randomCursor);

    for (const [key, value] of Object.entries(
      result.state.playerRelationships,
    )) {
      const [left, right] = key.split("::") as [PlayerId, PlayerId];
      expect(activePlayerIds.has(left)).toBe(true);
      expect(activePlayerIds.has(right)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
      expect(key).toBe(relationshipKey(left, right));
    }
  });

  it("expires an unused shop training boost when the academic year changes", () => {
    const state = createDemoGame();
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;
    state.shopEffects = {
      nextTrainingGrowthBoost: {
        percent: 20,
        remainingUses: 1,
        sourceItemId: "training-efficiency-boost",
      },
    };

    const result = advanceGameWeek(state, gameData);

    expect(result.academicYearTransition).not.toBeNull();
    expect(result.state.shopEffects?.nextTrainingGrowthBoost).toBeUndefined();
  });

  it("does not create a generational player before the scheduled year", () => {
    const state = createDemoGame();
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;
    state.world.nextGenerationalTalentYear = 6;

    const result = advanceGameWeek(state, gameData);

    expect(
      result.academicYearTransition?.generationalTalentPlayerId,
    ).toBeNull();
    expect(result.state.world.generationalTalentPlayerIds).toEqual([]);
  });

  it("keeps every school roster bounded across ten season changes", () => {
    let state = createDemoGame();

    for (let calendarYear = 2027; calendarYear <= 2036; calendarYear += 1) {
      const rolloverDate = `${calendarYear}-03-31` as GameDate;
      state = {
        ...state,
        date: rolloverDate,
        calendar: {
          ...state.calendar,
          currentDate: rolloverDate,
          weekOfYear: 52,
        },
      };

      const result = advanceGameWeek(state, gameData);
      expect(result.academicYearTransition).not.toBeNull();
      state = result.state;

      const activePlayerIdList = Object.values(state.schools).flatMap(
        (school) => school.playerIds,
      );
      expect(new Set(activePlayerIdList).size).toBe(activePlayerIdList.length);
      for (const school of Object.values(state.schools)) {
        expect(school.playerIds.length).toBeGreaterThanOrEqual(12);
        expect(school.playerIds.length).toBeLessThanOrEqual(16);
      }
    }
  });
});
