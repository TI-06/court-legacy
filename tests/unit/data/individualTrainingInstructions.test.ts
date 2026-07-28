import { loadGameData } from "../../../src/data/dataRegistry";
import { rawGameData } from "../../../src/data/rawGameData";

describe("individual training instruction data", () => {
  it("loads six validated individual instructions", () => {
    const registry = loadGameData(rawGameData);

    expect(registry.individualTrainingInstructions.size).toBe(6);
    expect(
      [...registry.individualTrainingInstructions.values()].every(
        (instruction) => instruction.targetAbilities.length > 0,
      ),
    ).toBe(true);
  });

  it("rejects an instruction without a target ability", () => {
    const raw = structuredClone(rawGameData);
    raw.individualTrainingInstructions[0].targetAbilities = [];

    expect(() => loadGameData(raw)).toThrow(
      "individualTrainingInstructions[0].targetAbilities",
    );
  });

  it("rejects duplicate instruction IDs", () => {
    const raw = structuredClone(rawGameData);
    raw.individualTrainingInstructions.push(
      structuredClone(raw.individualTrainingInstructions[0]),
    );

    expect(() => loadGameData(raw)).toThrow(
      "individualTrainingInstructions contains duplicate id",
    );
  });
});
