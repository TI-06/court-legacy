import { completeRawGameData } from "../../../src/data/completeRawGameData";
import { loadGameData } from "../../../src/data/dataRegistry";

describe("individual training instruction data", () => {
  it("loads validated player and coach-only individual instructions", () => {
    const registry = loadGameData(completeRawGameData);

    expect(registry.individualTrainingInstructions.size).toBe(11);
    expect(
      [...registry.individualTrainingInstructions.values()].every(
        (instruction) => instruction.targetAbilities.length > 0,
      ),
    ).toBe(true);
  });

  it("rejects an instruction without a target ability", () => {
    const raw = structuredClone(completeRawGameData);
    raw.individualTrainingInstructions[0]!.targetAbilities = [];

    expect(() => loadGameData(raw)).toThrow(
      "individualTrainingInstructions[0].targetAbilities",
    );
  });

  it("rejects duplicate instruction IDs", () => {
    const raw = structuredClone(completeRawGameData);
    raw.individualTrainingInstructions.push(
      structuredClone(raw.individualTrainingInstructions[0]!),
    );

    expect(() => loadGameData(raw)).toThrow(
      "individualTrainingInstructions contains duplicate id",
    );
  });
});
