import { describe, expect, it } from "vitest";
import { individualTrainingInstructions } from "../../../src/data/individualTrainingInstructions";

describe("Phase 12 individual training instructions", () => {
  it("exposes exactly the eleven player-facing choices", () => {
    expect(
      individualTrainingInstructions.map(({ id, name }) => ({ id, name })),
    ).toEqual([
      { id: "instruction.overall", name: "全体" },
      { id: "instruction.attack", name: "攻撃" },
      { id: "instruction.defense", name: "守備" },
      { id: "instruction.spike", name: "スパイク特化" },
      { id: "instruction.receive", name: "レシーブ特化" },
      { id: "instruction.serve", name: "サーブ特化" },
      { id: "instruction.set", name: "トス特化" },
      { id: "instruction.block", name: "ブロック特化" },
      { id: "instruction.jump", name: "跳躍" },
      { id: "instruction.fitness", name: "体力" },
      { id: "instruction.rest", name: "休養" },
    ]);
    expect(
      individualTrainingInstructions.every((item) => item.fatigue === 0),
    ).toBe(true);
    expect(
      individualTrainingInstructions.find(
        (item) => item.id === "instruction.rest",
      )?.tags,
    ).toContain("rest");
  });
});
