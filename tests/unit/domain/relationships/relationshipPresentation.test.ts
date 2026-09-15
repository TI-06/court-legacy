import { describe, expect, it } from "vitest";
import { relationshipLabel } from "../../../../src/domain/relationships/relationshipPresentation";

describe("relationshipLabel", () => {
  it.each([
    [0, "犬猿"],
    [19, "犬猿"],
    [20, "不仲"],
    [39, "不仲"],
    [40, "普通"],
    [59, "普通"],
    [60, "好相性"],
    [79, "好相性"],
    [80, "親友"],
    [100, "親友"],
  ] as const)("maps %s to %s", (score, expected) => {
    expect(relationshipLabel(score)).toBe(expected);
  });

  it("clamps defensive out-of-range scores before deriving the label", () => {
    expect(relationshipLabel(-40)).toBe("犬猿");
    expect(relationshipLabel(140)).toBe("親友");
  });
});
