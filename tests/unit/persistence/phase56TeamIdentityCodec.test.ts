import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import {
  decodeGameState,
  encodeGameState,
} from "../../../src/persistence/gameStateCodec";

describe("Phase56 team identity codec", () => {
  it("round-trips the compact team identity without a schema bump", () => {
    const state = createDemoGame();
    state.teamPlanning.teamIdentity = {
      style: "serve-block",
      mastery: 73,
      weeksInStyle: 11,
      changeCount: 2,
    };
    const schemaVersion = state.schemaVersion;

    const decoded = decodeGameState(encodeGameState(state));

    expect(decoded.schemaVersion).toBe(schemaVersion);
    expect(decoded.teamPlanning.teamIdentity).toEqual({
      style: "serve-block",
      mastery: 73,
      weeksInStyle: 11,
      changeCount: 2,
    });
  });

  it("keeps current-schema legacy saves valid when team identity is absent", () => {
    const state = createDemoGame();
    delete state.teamPlanning.teamIdentity;

    const decoded = decodeGameState(encodeGameState(state));

    expect(decoded.teamPlanning.teamIdentity).toBeUndefined();
  });

  it("rejects malformed persisted identity values", () => {
    const state = createDemoGame();
    const raw = JSON.parse(encodeGameState(state)) as Record<string, unknown>;
    const planning = raw.teamPlanning as Record<string, unknown>;
    planning.teamIdentity = {
      style: "serve-block",
      mastery: 101,
      weeksInStyle: 0,
      changeCount: 0,
    };

    expect(() => decodeGameState(JSON.stringify(raw))).toThrow(
      "セーブデータの形式が正しくありません",
    );
  });
});
