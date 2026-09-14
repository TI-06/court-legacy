import { createDemoGame } from "../../../src/app/createDemoGame";
import type { GameDate, SchoolId } from "../../../src/domain/model/identifiers";
import {
  decodeGameState,
  encodeGameState,
} from "../../../src/persistence/gameStateCodec";

type JsonObject = Record<string, unknown>;

function rawState(): JsonObject {
  return JSON.parse(encodeGameState(createDemoGame())) as JsonObject;
}

function weeklyScheduleOf(raw: JsonObject): JsonObject {
  return raw.weeklySchedule as JsonObject;
}

function practiceMatchOf(raw: JsonObject): JsonObject {
  return weeklyScheduleOf(raw).practiceMatch as JsonObject;
}

function opponentId(): SchoolId {
  const state = createDemoGame();
  return Object.keys(state.schools).find(
    (schoolId) => schoolId !== state.userSchoolId,
  ) as SchoolId;
}

describe("Phase20-3 canonical incoming practice offer ledger", () => {
  it("decodes the canonical top-level ledger with surfacedDate", () => {
    const raw = rawState();
    delete practiceMatchOf(raw).incomingOfferHistory;
    weeklyScheduleOf(raw).incomingPracticeOfferHistory = [
      {
        schoolId: opponentId(),
        surfacedDate: "2026-04-03" as GameDate,
      },
    ];

    expect(() => decodeGameState(JSON.stringify(raw))).not.toThrow();
    const decoded = decodeGameState(JSON.stringify(raw)) as unknown as {
      weeklySchedule: {
        incomingPracticeOfferHistory: Array<{
          schoolId: SchoolId;
          surfacedDate: GameDate;
        }>;
      };
    };
    expect(decoded.weeklySchedule.incomingPracticeOfferHistory).toEqual([
      {
        schoolId: opponentId(),
        surfacedDate: "2026-04-03",
      },
    ]);
  });

  it("normalizes an absent canonical ledger to an empty array", () => {
    const raw = rawState();
    delete practiceMatchOf(raw).incomingOfferHistory;
    delete weeklyScheduleOf(raw).incomingPracticeOfferHistory;

    const decoded = decodeGameState(JSON.stringify(raw)) as unknown as {
      weeklySchedule: { incomingPracticeOfferHistory: unknown[] };
    };
    expect(decoded.weeklySchedule.incomingPracticeOfferHistory).toEqual([]);
  });

  it("migrates the already-shipped nested 24-entry ledger shape", () => {
    const raw = rawState();
    const schoolId = opponentId();
    practiceMatchOf(raw).incomingOfferHistory = [
      { schoolId, date: "2026-03-05" as GameDate },
      { schoolId, date: "2026-03-19" as GameDate },
    ];
    delete weeklyScheduleOf(raw).incomingPracticeOfferHistory;

    const decoded = decodeGameState(JSON.stringify(raw)) as unknown as {
      weeklySchedule: {
        incomingPracticeOfferHistory: Array<{
          schoolId: SchoolId;
          surfacedDate: GameDate;
        }>;
        practiceMatch: Record<string, unknown>;
      };
    };

    expect(decoded.weeklySchedule.incomingPracticeOfferHistory).toEqual([
      { schoolId, surfacedDate: "2026-03-05" },
      { schoolId, surfacedDate: "2026-03-19" },
    ]);
    expect(decoded.weeklySchedule.practiceMatch).not.toHaveProperty(
      "incomingOfferHistory",
    );
  });

  it("accepts 32 canonical entries and rejects the 33rd", () => {
    const schoolId = opponentId();
    const entries = Array.from({ length: 32 }, (_, index) => ({
      schoolId,
      surfacedDate: `2025-${String(Math.floor(index / 3) + 1).padStart(2, "0")}-${String((index % 3) * 7 + 1).padStart(2, "0")}` as GameDate,
    }));
    const raw = rawState();
    delete practiceMatchOf(raw).incomingOfferHistory;
    weeklyScheduleOf(raw).incomingPracticeOfferHistory = entries;

    expect(() => decodeGameState(JSON.stringify(raw))).not.toThrow();

    weeklyScheduleOf(raw).incomingPracticeOfferHistory = [
      ...entries,
      { schoolId, surfacedDate: "2025-12-29" as GameDate },
    ];
    expect(() => decodeGameState(JSON.stringify(raw))).toThrow(
      "セーブデータの形式が正しくありません",
    );
  });
});
