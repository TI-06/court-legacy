import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import type {
  GameDate,
  PlayerId,
} from "../../../../src/domain/model/identifiers";

function thirdYearPlayerIds(
  state: ReturnType<typeof createDemoGame>,
): PlayerId[] {
  return Object.values(state.players)
    .filter((player) => player.grade === 3)
    .map((player) => player.id);
}

function secondYearPlayerIds(
  state: ReturnType<typeof createDemoGame>,
): PlayerId[] {
  return Object.values(state.players)
    .filter((player) => player.grade === 2)
    .map((player) => player.id);
}

function firstYearPlayerIds(
  state: ReturnType<typeof createDemoGame>,
): PlayerId[] {
  return Object.values(state.players)
    .filter((player) => player.grade === 1)
    .map((player) => player.id);
}

describe("academic year progression", () => {
  it("graduates third years, promotes returners, adds intake, and starts the next season", () => {
    const state = createDemoGame();
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;
    state.world.nextGenerationalTalentYear = 2;
    const originalThirdYears = thirdYearPlayerIds(state);
    const originalSecondYears = secondYearPlayerIds(state);
    const originalFirstYears = firstYearPlayerIds(state);

    const result = advanceGameWeek(state, gameData);
    const transition = result.academicYearTransition!;

    expect(transition).not.toBeNull();
    expect(result.state.calendar.academicYear).toBe(2);
    expect(result.state.officialSeason.academicYear).toBe(2);
    expect(
      result.state.officialSeason.interhigh.prefectural.matches,
    ).toHaveLength(15);
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
      if (school.id === result.state.userSchoolId) {
        if (school.captainPlayerId) {
          expect(school.playerIds).toContain(school.captainPlayerId);
        }
      } else {
        expect(school.captainPlayerId).not.toBeNull();
        expect(school.playerIds).toContain(school.captainPlayerId);
        expect(result.state.players[school.captainPlayerId!]?.grade).toBe(3);
      }
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

  it("does not reintroduce legacy rest recovery through an academic-year rollover", () => {
    const normalState = createDemoGame();
    normalState.date = "2027-03-31";
    normalState.calendar.currentDate = normalState.date;
    normalState.calendar.weekOfYear = 52;
    const playerId = normalState.schools[
      normalState.userSchoolId
    ]!.playerIds.find((id) => normalState.players[id]!.grade !== 3)!;
    normalState.players[playerId] = {
      ...normalState.players[playerId]!,
      fatigue: 70,
      condition: 50,
      injury: null,
    };
    const restingState = structuredClone(normalState);

    const normal = advanceGameWeek(normalState, gameData);
    const rested = advanceGameWeek(restingState, gameData, {
      restingPlayerIds: new Set([playerId]),
    });

    expect(normal.academicYearTransition).not.toBeNull();
    expect(rested.academicYearTransition).not.toBeNull();
    expect(rested.state.players[playerId]!.fatigue).toBe(
      normal.state.players[playerId]!.fatigue,
    );
    expect(rested.state.players[playerId]!.condition).toBe(
      normal.state.players[playerId]!.condition,
    );
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

      state = advanceGameWeek(state, gameData).state;

      for (const school of Object.values(state.schools)) {
        expect(school.playerIds.length).toBeGreaterThanOrEqual(12);
        expect(school.playerIds.length).toBeLessThanOrEqual(16);
      }
    }
  });

  it("keeps the same long-run state for the same seed and actions", () => {
    let first = createDemoGame();
    let second = createDemoGame();

    for (let calendarYear = 2027; calendarYear <= 2036; calendarYear += 1) {
      const rolloverDate = `${calendarYear}-03-31` as GameDate;
      first = {
        ...first,
        date: rolloverDate,
        calendar: {
          ...first.calendar,
          currentDate: rolloverDate,
          weekOfYear: 52,
        },
      };
      second = {
        ...second,
        date: rolloverDate,
        calendar: {
          ...second.calendar,
          currentDate: rolloverDate,
          weekOfYear: 52,
        },
      };

      first = advanceGameWeek(first, gameData).state;
      second = advanceGameWeek(second, gameData).state;
    }

    expect(first).toEqual(second);
  });
});
