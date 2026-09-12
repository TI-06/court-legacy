import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import {
  decodeGameState,
  encodeGameState,
} from "../../../src/persistence/gameStateCodec";

describe("Phase17 game state codec", () => {
  it("round-trips season goals on schema v8", () => {
    const state = createDemoGame();

    const decoded = decodeGameState(encodeGameState(state));

    expect(decoded.schemaVersion).toBe(8);
    expect(decoded.seasonGoals).toEqual(state.seasonGoals);
    expect(decoded.history.seasonGoalSeasons).toEqual([]);
  });

  it("accepts an older v8 save with no Phase17 fields", () => {
    const state = structuredClone(createDemoGame());
    const legacy = state as typeof state & {
      seasonGoals?: unknown;
      history: typeof state.history & { seasonGoalSeasons?: unknown };
    };
    delete legacy.seasonGoals;
    delete legacy.history.seasonGoalSeasons;

    const decoded = decodeGameState(JSON.stringify(legacy));

    expect(decoded.schemaVersion).toBe(8);
    expect(decoded.seasonGoals).toBeUndefined();
    expect(decoded.history.seasonGoalSeasons).toBeUndefined();
  });

  it("rejects malformed Phase17 state when the fields are present", () => {
    const state = createDemoGame();

    expect(() =>
      decodeGameState(
        JSON.stringify({
          ...state,
          seasonGoals: {
            ...state.seasonGoals,
            goals: [
              {
                id: "season:1:bad",
                kind: "client-defined",
                target: -10,
              },
            ],
          },
        }),
      ),
    ).toThrow("セーブデータの形式が正しくありません");
  });

  it("rejects goal-kind payloads with incompatible achievement fields", () => {
    const state = createDemoGame();
    const goals = structuredClone(state.seasonGoals!.goals);
    goals[0] = {
      ...goals[0]!,
      achievement: "national-title",
    };
    const tournamentGoalIndex = goals.findIndex(
      (goal) => goal.kind === "tournament-achievement",
    );
    const tournamentGoal = goals[tournamentGoalIndex]!;
    goals[tournamentGoalIndex] = {
      id: tournamentGoal.id,
      kind: "tournament-achievement",
      target: tournamentGoal.target,
    } as typeof tournamentGoal;

    expect(() =>
      decodeGameState(
        JSON.stringify({
          ...state,
          seasonGoals: {
            ...state.seasonGoals,
            goals,
          },
        }),
      ),
    ).toThrow("セーブデータの形式が正しくありません");
  });
});
