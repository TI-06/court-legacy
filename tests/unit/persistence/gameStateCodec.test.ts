import { createDemoGame } from "../../../src/app/createDemoGame";
import type { GameDate } from "../../../src/domain/model/identifiers";
import {
  decodeGameState,
  encodeGameState,
} from "../../../src/persistence/gameStateCodec";

describe("game state codec", () => {
  it("round-trips the complete game state without changing values", () => {
    const state = createDemoGame();

    const decoded = decodeGameState(encodeGameState(state));

    expect(decoded).toEqual(state);
    expect(decoded).not.toBe(state);
  });

  it("round-trips a training-result notification", () => {
    const state = createDemoGame();
    const withNotification = {
      ...state,
      notifications: {
        items: [
          {
            id: "training-result:school-user:1:1:2026-04-01",
            type: "training-result" as const,
            createdGameDate: "2026-04-01" as GameDate,
            academicYearIndex: 1,
            weekOfYear: 1,
            readAtGameDate: null,
            payload: {
              teamTrainingMenuName: "基礎練習",
              totalAbilityGrowth: 3,
              totalFatigueChange: 5,
              injuredCount: 0,
              players: [],
            },
          },
        ],
      },
    };

    const decoded = decodeGameState(encodeGameState(withNotification));

    expect(decoded.notifications.items).toEqual(
      withNotification.notifications.items,
    );
  });

  it("rejects malformed notification payloads", () => {
    const state = createDemoGame();

    expect(() =>
      decodeGameState(
        JSON.stringify({
          ...state,
          notifications: {
            items: [
              {
                id: "training-result:school-user:1:1:2026-04-01",
                type: "training-result",
                createdGameDate: "2026-04-01",
                academicYearIndex: 1,
                weekOfYear: 1,
                readAtGameDate: null,
                payload: {
                  teamTrainingMenuName: "基礎練習",
                  totalAbilityGrowth: "client-defined",
                  totalFatigueChange: 5,
                  injuredCount: 0,
                  players: [],
                },
              },
            ],
          },
        }),
      ),
    ).toThrow("セーブデータの形式が正しくありません");
  });

  it("round-trips a pending one-use shop training boost", () => {
    const state = createDemoGame();
    const withBoost = {
      ...state,
      shopEffects: {
        nextTrainingGrowthBoost: {
          percent: 20 as const,
          remainingUses: 1 as const,
          sourceItemId: "training-efficiency-boost" as const,
        },
      },
    };

    const decoded = decodeGameState(encodeGameState(withBoost));

    expect(decoded.shopEffects?.nextTrainingGrowthBoost).toEqual({
      percent: 20,
      remainingUses: 1,
      sourceItemId: "training-efficiency-boost",
    });
  });

  it("rejects malformed pending shop effects instead of accepting arbitrary values", () => {
    const state = createDemoGame();

    expect(() =>
      decodeGameState(
        JSON.stringify({
          ...state,
          shopEffects: {
            nextTrainingGrowthBoost: {
              percent: 99,
              remainingUses: 4,
              sourceItemId: "client-defined-boost",
            },
          },
        }),
      ),
    ).toThrow("セーブデータの形式が正しくありません");
  });

  it("rejects corrupted JSON instead of returning a partial state", () => {
    expect(() => decodeGameState('{"schemaVersion":1')).toThrow(
      "セーブデータを読み取れません",
    );
  });

  it("migrates a legacy unversioned state to the current schema", () => {
    const current = createDemoGame();
    const legacy = {
      ...current,
      schemaVersion: 0,
      settings: {
        matchDisplayMode: current.settings.matchDisplayMode,
        matchPlaybackSpeed: current.settings.matchPlaybackSpeed,
        reducedMotion: current.settings.reducedMotion,
      },
    };

    const migrated = decodeGameState(JSON.stringify(legacy));

    expect(migrated.schemaVersion).toBe(current.schemaVersion);
    expect(migrated.settings.autosaveEnabled).toBe(true);
    expect(migrated.settings.confirmBeforeOfficialMatch).toBe(true);
  });

  it("migrates v6 funds into v7 without paying the current-year budget again", () => {
    const current = createDemoGame();
    const legacy = structuredClone(current) as typeof current & {
      schoolManagement?: typeof current.schoolManagement;
    };
    legacy.schemaVersion = 6;
    delete legacy.schoolManagement;
    legacy.schools[legacy.userSchoolId]!.funds = 777;

    const migrated = decodeGameState(JSON.stringify(legacy));

    expect(migrated.schemaVersion).toBe(7);
    expect(migrated.schools[migrated.userSchoolId]!.funds).toBe(777);
    expect(migrated.schoolManagement).toEqual({
      assistantCoach: null,
      fundsHistory: [],
      lastAnnualBudgetYearIndex: legacy.yearIndex,
    });
  });

  it("rejects malformed funds ledger entries", () => {
    const state = createDemoGame();

    expect(() =>
      decodeGameState(
        JSON.stringify({
          ...state,
          schoolManagement: {
            ...state.schoolManagement,
            fundsHistory: [
              {
                id: "bad-entry",
                gameDate: state.date,
                academicYearIndex: state.yearIndex,
                kind: "shop-grant",
                amount: 300,
                balanceAfter: -1,
                label: "invalid",
              },
            ],
          },
        }),
      ),
    ).toThrow("セーブデータの形式が正しくありません");
  });

  it("rejects a future schema version", () => {
    const state = createDemoGame();

    expect(() =>
      decodeGameState(
        JSON.stringify({ ...state, schemaVersion: state.schemaVersion + 1 }),
      ),
    ).toThrow("新しいバージョンのセーブデータです");
  });
});
