import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { createNationalStage } from "../../../../src/domain/tournament/createNationalStage";
import { advanceOfficialTournamentsThroughWeek } from "../../../../src/domain/tournament/progressOfficialTournaments";
import {
  selectNextOfficialEvent,
  selectTournamentStageView,
} from "../../../../src/domain/tournament/tournamentSelectors";
import type { WorldSchoolTournamentEntrant } from "../../../../src/domain/tournament/tournamentTypes";

function withWeek<T extends ReturnType<typeof createDemoGame>>(
  state: T,
  weekOfYear: number,
): T {
  return {
    ...state,
    calendar: {
      ...state.calendar,
      weekOfYear,
    },
  };
}

describe("tournament presentation selectors", () => {
  it("selects the user's next scheduled official match before it becomes due", () => {
    const state = createDemoGame();

    const next = selectNextOfficialEvent(state);

    expect(next).toMatchObject({
      kind: "match",
      circuit: "interhigh",
      level: "prefectural",
      round: "round-of-16",
      scheduledWeek: 9,
      timing: "upcoming",
      weeksUntil: 8,
    });
    if (next?.kind !== "match") {
      throw new Error("expected an upcoming official match");
    }
    expect(next.opponent.displayName.length).toBeGreaterThan(0);
    expect(next.opponent.shortName.length).toBeGreaterThan(0);
  });

  it("marks the current unresolved user match as due", () => {
    const state = advanceOfficialTournamentsThroughWeek(
      withWeek(createDemoGame(), 9),
    );

    const next = selectNextOfficialEvent(state);

    expect(next).toMatchObject({
      kind: "match",
      circuit: "interhigh",
      level: "prefectural",
      round: "round-of-16",
      scheduledWeek: 9,
      timing: "due",
      weeksUntil: 0,
    });
  });

  it("moves to the next circuit start after the user is eliminated", () => {
    const base = withWeek(createDemoGame(), 10);
    const state = {
      ...base,
      officialSeason: {
        ...base.officialSeason,
        interhigh: {
          ...base.officialSeason.interhigh,
          prefectural: {
            ...base.officialSeason.interhigh.prefectural,
            userEliminated: true,
          },
        },
      },
    };

    const next = selectNextOfficialEvent(state);

    expect(next).toEqual({
      kind: "circuit-start",
      academicYear: state.officialSeason.academicYear,
      circuit: "spring-high",
      level: "prefectural",
      scheduledWeek: 30,
      weeksUntil: 20,
    });
  });

  it("builds a public national bracket DTO without guest seeds, strength, or player truth", () => {
    const base = createDemoGame();
    const champion = base.officialSeason.interhigh.prefectural.entrants.find(
      (entrant): entrant is WorldSchoolTournamentEntrant =>
        entrant.source === "world-school" &&
        entrant.schoolId === base.userSchoolId,
    );
    if (!champion) {
      throw new Error("user tournament entrant not found");
    }
    const national = createNationalStage({
      state: base,
      circuit: "interhigh",
      champion,
    });
    const state = {
      ...base,
      officialSeason: {
        ...base.officialSeason,
        interhigh: {
          ...base.officialSeason.interhigh,
          national,
        },
      },
    };

    const view = selectTournamentStageView(state, "interhigh", "national");

    expect(view?.entrants).toHaveLength(16);
    expect(view?.matches).toHaveLength(15);
    expect(view?.entrants.some((entrant) => entrant.regionLabel !== null)).toBe(
      true,
    );
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("guestSeed");
    expect(serialized).not.toContain("seedStrength");
    expect(serialized).not.toContain("playerIds");
  });

  it("exposes eliminated stage status without inventing a future opponent", () => {
    const base = createDemoGame();
    const state = {
      ...base,
      officialSeason: {
        ...base.officialSeason,
        interhigh: {
          ...base.officialSeason.interhigh,
          prefectural: {
            ...base.officialSeason.interhigh.prefectural,
            userEliminated: true,
            userBestRound: "round-of-16" as const,
          },
        },
      },
    };

    const view = selectTournamentStageView(state, "interhigh", "prefectural");

    expect(view).toMatchObject({
      status: "eliminated",
      userBestRound: "round-of-16",
    });
  });
});

