import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import { createOfficialSeason } from "../../../../src/domain/tournament/createOfficialSeason";
import { createNationalStage } from "../../../../src/domain/tournament/createNationalStage";
import type {
  GuestTournamentEntrant,
  WorldSchoolTournamentEntrant,
} from "../../../../src/domain/tournament/tournamentTypes";

function createState(seed = "phase6-national-stage") {
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

function userChampion(
  state: ReturnType<typeof createState>,
): WorldSchoolTournamentEntrant {
  const stage = createOfficialSeason({ state }).interhigh.prefectural;
  const champion = stage.entrants.find(
    (entrant): entrant is WorldSchoolTournamentEntrant =>
      entrant.source === "world-school" &&
      entrant.schoolId === state.userSchoolId,
  );
  if (!champion) {
    throw new Error("user entrant was not generated");
  }
  return champion;
}

describe("createNationalStage", () => {
  it("creates one persistent champion and 15 deterministic guest representatives", () => {
    const state = createState();
    const before = structuredClone(state);
    const champion = userChampion(state);

    const first = createNationalStage({
      state,
      circuit: "interhigh",
      champion,
    });
    const second = createNationalStage({
      state,
      circuit: "interhigh",
      champion,
    });

    expect(first).toEqual(second);
    expect(state).toEqual(before);
    expect(first.level).toBe("national");
    expect(first.entrants).toHaveLength(16);
    expect(first.matches).toHaveLength(15);
    expect(
      new Set(first.entrants.map((entrant) => entrant.entrantId)).size,
    ).toBe(16);

    const worldEntrants = first.entrants.filter(
      (entrant): entrant is WorldSchoolTournamentEntrant =>
        entrant.source === "world-school",
    );
    const guests = first.entrants.filter(
      (entrant): entrant is GuestTournamentEntrant =>
        entrant.source === "guest-representative",
    );

    expect(worldEntrants).toHaveLength(1);
    expect(worldEntrants[0]?.schoolId).toBe(champion.schoolId);
    expect(guests).toHaveLength(15);
    expect(new Set(guests.map((guest) => guest.guestSeed)).size).toBe(15);
    expect(new Set(guests.map((guest) => guest.displayName)).size).toBe(15);
    expect(
      guests.every(
        (guest) => guest.seedStrength >= 45 && guest.seedStrength <= 115,
      ),
    ).toBe(true);
  });

  it("changes the deterministic guest field across circuit or academic year", () => {
    const state = createState("phase6-national-distinct");
    const champion = userChampion(state);

    const interhigh = createNationalStage({
      state,
      circuit: "interhigh",
      champion,
    });
    const springHigh = createNationalStage({
      state,
      circuit: "spring-high",
      champion,
    });
    const nextYear = createNationalStage({
      state: {
        ...state,
        calendar: {
          ...state.calendar,
          academicYear: state.calendar.academicYear + 1,
        },
      },
      circuit: "interhigh",
      champion,
    });

    const guestSeeds = (stage: typeof interhigh) =>
      stage.entrants
        .filter(
          (entrant): entrant is GuestTournamentEntrant =>
            entrant.source === "guest-representative",
        )
        .map((guest) => guest.guestSeed);

    expect(guestSeeds(interhigh)).not.toEqual(guestSeeds(springHigh));
    expect(guestSeeds(interhigh)).not.toEqual(guestSeeds(nextYear));
  });
});
