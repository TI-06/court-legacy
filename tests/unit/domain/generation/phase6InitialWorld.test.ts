import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";

describe("Phase 6 initial world", () => {
  it("starts on schema v3 with a deterministic official season", () => {
    const state = createInitialGame({
      seed: "phase6-schema-v3",
      schoolName: "青葉高校",
      schoolShortName: "青葉",
      coachName: "高橋 監督",
      regionId: "region.chiba",
      uniform: {
        primary: "#17365D",
        secondary: "#FFFFFF",
        accent: "#D99B2B",
      },
    });

    expect(state.schemaVersion).toBe(3);
    expect(state.officialSeason.academicYear).toBe(state.calendar.academicYear);
    expect(state.officialSeason.interhigh.prefectural.entrants).toHaveLength(16);
    expect(state.officialSeason.springHigh.prefectural.entrants).toHaveLength(16);
    expect(state.officialSeason.interhigh.national).toBeNull();
    expect(state.officialSeason.springHigh.national).toBeNull();
    expect(state.history.officialTournaments).toEqual([]);
  });
});
