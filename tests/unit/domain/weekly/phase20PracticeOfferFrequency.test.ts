import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { GameState } from "../../../../src/domain/model/GameState";
import type { GameDate, SchoolId } from "../../../../src/domain/model/identifiers";
import * as practicePlanning from "../../../../src/domain/weekly/practiceMatchPlanning";

interface IncomingOfferHistoryEntry {
  schoolId: SchoolId;
  date: GameDate;
}

function eliteState(): GameState {
  const state = createDemoGame();
  const home = state.schools[state.userSchoolId]!;
  state.schools[state.userSchoolId] = {
    ...home,
    reputation: "elite",
  };
  return state;
}

function withDate(state: GameState, date: GameDate): GameState {
  return {
    ...state,
    date,
    calendar: {
      ...state.calendar,
      currentDate: date,
    },
  };
}

function withIncomingHistory(
  state: GameState,
  entries: readonly IncomingOfferHistoryEntry[],
): GameState {
  const weeklySchedule = {
    ...state.weeklySchedule,
    incomingOfferHistory: entries.map((entry) => ({ ...entry })),
  };
  return {
    ...state,
    weeklySchedule,
  } as GameState;
}

function findOfferState(
  base: GameState,
  yearMonth: string,
): { state: GameState; schoolId: SchoolId } {
  for (let day = 1; day <= 28; day += 1) {
    const state = withDate(
      base,
      `${yearMonth}-${String(day).padStart(2, "0")}` as GameDate,
    );
    const offer = practicePlanning.buildPracticePlanning(state).incomingOffer;
    if (offer) {
      return { state, schoolId: offer.schoolId };
    }
  }
  throw new Error(`expected at least one incoming offer in ${yearMonth}`);
}

describe("Phase20-3 incoming practice offer frequency", () => {
  it("caps incoming offers at two per calendar month even when prior offers were declined", () => {
    const base = eliteState();
    const { state } = findOfferState(base, "2026-04");
    const opponents = Object.keys(state.schools).filter(
      (schoolId) => schoolId !== state.userSchoolId,
    ) as SchoolId[];
    const limited = withIncomingHistory(state, [
      { schoolId: opponents[0]!, date: "2026-04-03" as GameDate },
      { schoolId: opponents[1]!, date: "2026-04-10" as GameDate },
    ]);

    expect(practicePlanning.buildPracticePlanning(limited).incomingOffer).toBeNull();
  });

  it("avoids a school already offered in the same month when alternatives exist", () => {
    const base = eliteState();
    const { state, schoolId } = findOfferState(base, "2026-04");
    const diversified = withIncomingHistory(state, [
      { schoolId, date: "2026-04-02" as GameDate },
    ]);
    const offer = practicePlanning.buildPracticePlanning(diversified).incomingOffer;

    expect(offer).not.toBeNull();
    expect(offer!.schoolId).not.toBe(schoolId);
  });

  it("penalizes schools that dominated older incoming offers so the same school does not keep returning", () => {
    const base = eliteState();
    const { state, schoolId } = findOfferState(base, "2026-04");
    const diversified = withIncomingHistory(state, [
      { schoolId, date: "2026-01-08" as GameDate },
      { schoolId, date: "2026-02-05" as GameDate },
      { schoolId, date: "2026-02-19" as GameDate },
      { schoolId, date: "2026-03-05" as GameDate },
    ]);
    const offer = practicePlanning.buildPracticePlanning(diversified).incomingOffer;

    expect(offer).not.toBeNull();
    expect(offer!.schoolId).not.toBe(schoolId);
  });

  it("resets the monthly cap when the calendar month changes", () => {
    const base = eliteState();
    const { state } = findOfferState(base, "2026-05");
    const opponents = Object.keys(state.schools).filter(
      (schoolId) => schoolId !== state.userSchoolId,
    ) as SchoolId[];
    const afterRollover = withIncomingHistory(state, [
      { schoolId: opponents[0]!, date: "2026-04-03" as GameDate },
      { schoolId: opponents[1]!, date: "2026-04-17" as GameDate },
    ]);

    expect(practicePlanning.buildPracticePlanning(afterRollover).incomingOffer).not.toBeNull();
  });

  it("remains deterministic for the same seed, date, and offer history", () => {
    const base = eliteState();
    const { state } = findOfferState(base, "2026-04");
    const opponents = Object.keys(state.schools).filter(
      (schoolId) => schoolId !== state.userSchoolId,
    ) as SchoolId[];
    const withHistory = withIncomingHistory(state, [
      { schoolId: opponents[0]!, date: "2026-03-05" as GameDate },
    ]);

    expect(practicePlanning.buildPracticePlanning(withHistory)).toEqual(
      practicePlanning.buildPracticePlanning(withHistory),
    );
  });
});
