import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import { createOfficialSeason } from "../../../../src/domain/tournament/createOfficialSeason";
import { tournamentRoundWeek } from "../../../../src/domain/tournament/tournamentSchedule";

function createState(seed = "phase6-tournament-fixture") {
  return createInitialGame({
    seed,
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
}

describe("official tournament schedule", () => {
  it("uses the approved Interhigh academic weeks", () => {
    expect(tournamentRoundWeek("interhigh", "prefectural", "round-of-16")).toBe(
      9,
    );
    expect(
      tournamentRoundWeek("interhigh", "prefectural", "quarterfinal"),
    ).toBe(10);
    expect(tournamentRoundWeek("interhigh", "prefectural", "semifinal")).toBe(
      11,
    );
    expect(tournamentRoundWeek("interhigh", "prefectural", "final")).toBe(12);
    expect(tournamentRoundWeek("interhigh", "national", "round-of-16")).toBe(
      16,
    );
    expect(tournamentRoundWeek("interhigh", "national", "quarterfinal")).toBe(
      17,
    );
    expect(tournamentRoundWeek("interhigh", "national", "semifinal")).toBe(18);
    expect(tournamentRoundWeek("interhigh", "national", "final")).toBe(19);
  });

  it("uses the approved Spring High academic weeks", () => {
    expect(
      tournamentRoundWeek("spring-high", "prefectural", "round-of-16"),
    ).toBe(30);
    expect(
      tournamentRoundWeek("spring-high", "prefectural", "quarterfinal"),
    ).toBe(31);
    expect(tournamentRoundWeek("spring-high", "prefectural", "semifinal")).toBe(
      32,
    );
    expect(tournamentRoundWeek("spring-high", "prefectural", "final")).toBe(33);
    expect(tournamentRoundWeek("spring-high", "national", "round-of-16")).toBe(
      41,
    );
    expect(tournamentRoundWeek("spring-high", "national", "quarterfinal")).toBe(
      42,
    );
    expect(tournamentRoundWeek("spring-high", "national", "semifinal")).toBe(
      43,
    );
    expect(tournamentRoundWeek("spring-high", "national", "final")).toBe(44);
  });
});

describe("createOfficialSeason", () => {
  it("creates stable Interhigh and Spring High prefectural brackets from the 16 persistent schools", () => {
    const state = createState();
    const before = structuredClone(state);

    const first = createOfficialSeason({ state });
    const second = createOfficialSeason({ state });

    expect(first).toEqual(second);
    expect(state).toEqual(before);
    expect(state.randomCursor).toBe(before.randomCursor);
    expect(first.academicYear).toBe(state.calendar.academicYear);

    for (const stage of [
      first.interhigh.prefectural,
      first.springHigh.prefectural,
    ]) {
      expect(stage.level).toBe("prefectural");
      expect(stage.entrants).toHaveLength(16);
      expect(
        new Set(stage.entrants.map((entrant) => entrant.entrantId)).size,
      ).toBe(16);
      expect(
        stage.entrants.every(
          (entrant) =>
            entrant.source === "world-school" &&
            Boolean(state.schools[entrant.schoolId]),
        ),
      ).toBe(true);
      expect(stage.matches).toHaveLength(15);
      expect(
        stage.matches.filter((match) => match.round === "round-of-16"),
      ).toHaveLength(8);
      expect(
        stage.matches.filter((match) => match.round === "quarterfinal"),
      ).toHaveLength(4);
      expect(
        stage.matches.filter((match) => match.round === "semifinal"),
      ).toHaveLength(2);
      expect(
        stage.matches.filter((match) => match.round === "final"),
      ).toHaveLength(1);
      expect(stage.championEntrantId).toBeNull();
      expect(stage.userEliminated).toBe(false);
    }
  });

  it("places the four strongest seeds in separate bracket quadrants", () => {
    const state = createState("phase6-top-seeds");
    const stage = createOfficialSeason({ state }).interhigh.prefectural;
    const topFour = [...stage.entrants]
      .sort(
        (left, right) =>
          right.seedStrength - left.seedStrength ||
          left.entrantId.localeCompare(right.entrantId),
      )
      .slice(0, 4);
    const roundOf16 = stage.matches.filter(
      (match) => match.round === "round-of-16",
    );

    const quadrants = topFour.map((entrant) => {
      const match = roundOf16.find(
        (candidate) =>
          candidate.homeEntrantId === entrant.entrantId ||
          candidate.awayEntrantId === entrant.entrantId,
      );
      expect(match).toBeDefined();
      return Math.floor(match!.slotIndex / 2);
    });

    expect(new Set(quadrants).size).toBe(4);
  });

  it("does not force a weakened user school into a top seed", () => {
    const state = createState("phase6-no-user-bonus");
    const userSchool = state.schools[state.userSchoolId]!;
    state.schools[state.userSchoolId] = {
      ...userSchool,
      reputationPoints: 0,
    };
    for (const playerId of userSchool.playerIds) {
      const player = state.players[playerId]!;
      state.players[playerId] = {
        ...player,
        abilities: Object.fromEntries(
          Object.keys(player.abilities).map((key) => [key, 1]),
        ) as typeof player.abilities,
      };
    }

    const stage = createOfficialSeason({ state }).interhigh.prefectural;
    const ranked = [...stage.entrants].sort(
      (left, right) =>
        right.seedStrength - left.seedStrength ||
        left.entrantId.localeCompare(right.entrantId),
    );
    const userEntrant = ranked.find(
      (entrant) =>
        entrant.source === "world-school" &&
        entrant.schoolId === state.userSchoolId,
    );

    expect(userEntrant).toBeDefined();
    expect(ranked.indexOf(userEntrant!)).toBeGreaterThanOrEqual(4);
  });
});
