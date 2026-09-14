import { createDemoGame } from "../../../src/app/createDemoGame";
import type { GameDate, SchoolId } from "../../../src/domain/model/identifiers";
import {
  PRACTICE_INCOMING_HISTORY_LIMIT,
  buildPracticePlanning,
} from "../../../src/domain/weekly/practiceMatchPlanning";
import {
  decodeGameState,
  encodeGameState,
} from "../../../src/persistence/gameStateCodec";

function previousOfferHistory(schoolId: SchoolId) {
  return Array.from({ length: PRACTICE_INCOMING_HISTORY_LIMIT }, (_, index) => ({
    schoolId,
    date: `2025-${String(Math.floor(index / 2) + 1).padStart(2, "0")}-${index % 2 === 0 ? "05" : "19"}` as GameDate,
  }));
}

describe("Phase20-3 practice offer history persistence", () => {
  it("defaults a current-schema save with no offer history to an empty history", () => {
    const state = structuredClone(createDemoGame());
    const legacyPracticeMatch = state.weeklySchedule.practiceMatch as typeof state.weeklySchedule.practiceMatch & {
      incomingOfferHistory?: unknown;
    };
    delete legacyPracticeMatch.incomingOfferHistory;

    const decoded = decodeGameState(JSON.stringify(state));

    expect(decoded.weeklySchedule.practiceMatch.incomingOfferHistory).toEqual([]);
  });

  it("round-trips received offer history without changing entries", () => {
    const state = structuredClone(createDemoGame());
    const opponents = Object.keys(state.schools).filter(
      (schoolId) => schoolId !== state.userSchoolId,
    ) as SchoolId[];
    state.weeklySchedule.practiceMatch.incomingOfferHistory = [
      { schoolId: opponents[0]!, date: "2026-04-03" as GameDate },
      { schoolId: opponents[1]!, date: "2026-04-17" as GameDate },
    ];

    const decoded = decodeGameState(encodeGameState(state));

    expect(decoded.weeklySchedule.practiceMatch.incomingOfferHistory).toEqual(
      state.weeklySchedule.practiceMatch.incomingOfferHistory,
    );
  });

  it("keeps generated offer history bounded at the authoritative limit", () => {
    const state = structuredClone(createDemoGame());
    const home = state.schools[state.userSchoolId]!;
    state.schools[state.userSchoolId] = { ...home, reputation: "elite" };
    const opponent = Object.keys(state.schools).find(
      (schoolId) => schoolId !== state.userSchoolId,
    ) as SchoolId;
    state.weeklySchedule.practiceMatch.incomingOfferHistory =
      previousOfferHistory(opponent);

    let planning = buildPracticePlanning(state);
    for (let day = 1; day <= 28 && planning.incomingOffer === null; day += 1) {
      state.date = `2026-04-${String(day).padStart(2, "0")}` as GameDate;
      state.calendar.currentDate = state.date;
      planning = buildPracticePlanning(state);
    }

    expect(planning.incomingOffer).not.toBeNull();
    expect(planning.incomingOfferHistory).toHaveLength(
      PRACTICE_INCOMING_HISTORY_LIMIT,
    );
    expect(planning.incomingOfferHistory.at(-1)).toMatchObject({
      schoolId: planning.incomingOffer!.schoolId,
      date: state.date,
    });
  });

  it("rejects persisted histories above the bounded limit", () => {
    const state = structuredClone(createDemoGame());
    const opponent = Object.keys(state.schools).find(
      (schoolId) => schoolId !== state.userSchoolId,
    ) as SchoolId;
    state.weeklySchedule.practiceMatch.incomingOfferHistory = [
      ...previousOfferHistory(opponent),
      { schoolId: opponent, date: "2025-12-31" as GameDate },
    ];

    expect(() => decodeGameState(JSON.stringify(state))).toThrow(
      "セーブデータの形式が正しくありません",
    );
  });
});
