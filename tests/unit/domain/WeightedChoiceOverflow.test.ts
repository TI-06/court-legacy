import { SeededRandom } from "../../../src/domain/random/SeededRandom";
import { weightedChoice } from "../../../src/domain/random/weightedChoice";

describe("weightedChoice total weight", () => {
  it("rejects a finite-item list whose total weight overflows", () => {
    const random = new SeededRandom("weights-overflow");

    expect(() =>
      weightedChoice(
        [
          { value: "A", weight: Number.MAX_VALUE },
          { value: "B", weight: Number.MAX_VALUE },
        ],
        random,
      ),
    ).toThrow("total weight must be finite");
  });
});
