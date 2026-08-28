import { createDemoGame } from "../../../src/app/createDemoGame";
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

  it("rejects a future schema version", () => {
    const state = createDemoGame();

    expect(() =>
      decodeGameState(
        JSON.stringify({ ...state, schemaVersion: state.schemaVersion + 1 }),
      ),
    ).toThrow("新しいバージョンのセーブデータです");
  });
});
