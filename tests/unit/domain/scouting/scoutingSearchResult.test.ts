import { describe, expect, it } from "vitest";
import type { ScoutReport } from "../../../../src/domain/scouting/scoutReport";
import { scoutingSearchResultPresentation } from "../../../../src/domain/scouting/scoutingSearchResult";

function report(stars: number, potentialMax: number): ScoutReport {
  return {
    candidateId: `candidate-${stars}-${potentialMax}` as ScoutReport["candidateId"],
    displayName: "候補",
    heightCm: 180,
    position: "OH",
    handedness: "right",
    middleSchoolAchievement: "unknown",
    evaluationStars: stars as 1 | 2 | 3 | 4 | 5,
    estimatedOverall: { min: 40, max: 60 },
    estimatedPotential: { min: 50, max: potentialMax },
    confidence: "low",
    comments: [],
  };
}

describe("scoutingSearchResultPresentation", () => {
  it("shows a genius rumor for an elite high-potential candidate", () => {
    expect(scoutingSearchResultPresentation([report(5, 92)]).tone).toBe("genius-rumor");
  });

  it("shows standout when multiple four-star candidates are found", () => {
    expect(scoutingSearchResultPresentation([report(4, 84), report(4, 82)]).tone).toBe("standout");
  });

  it("shows poor when the search has no notable candidate", () => {
    expect(scoutingSearchResultPresentation([report(2, 70), report(3, 74)]).tone).toBe("poor");
  });
});
