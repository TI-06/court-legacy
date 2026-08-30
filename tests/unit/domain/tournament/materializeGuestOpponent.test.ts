import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import { calculateTournamentSchoolStrength } from "../../../../src/domain/tournament/createOfficialSeason";
import { materializeGuestOpponent } from "../../../../src/domain/tournament/materializeGuestOpponent";
import type { GuestTournamentEntrant } from "../../../../src/domain/tournament/tournamentTypes";

function createState(seed = "phase6-guest-materialization") {
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

function guest(seedStrength = 86): GuestTournamentEntrant {
  return {
    entrantId: "guest:interhigh:1:7",
    source: "guest-representative",
    displayName: "星陵学院",
    shortName: "星陵",
    regionLabel: "東海地区",
    guestSeed: "guest-materialization-seed-7",
    seedStrength,
  };
}

function data() {
  if (!gameDataBootstrap.ok) {
    throw new Error(gameDataBootstrap.message);
  }
  return gameDataBootstrap.data;
}

describe("materializeGuestOpponent", () => {
  it("materializes the same temporary school, roster, and selection from the same guest seed", () => {
    const state = createState();
    const entrant = guest();

    const first = materializeGuestOpponent({ state, entrant, data: data() });
    const second = materializeGuestOpponent({ state, entrant, data: data() });

    expect(first.school).toEqual(second.school);
    expect(first.selection).toEqual(second.selection);
    expect(
      first.school.playerIds.map(
        (playerId) => first.temporaryState.players[playerId],
      ),
    ).toEqual(
      second.school.playerIds.map(
        (playerId) => second.temporaryState.players[playerId],
      ),
    );
  });

  it("creates at least seven eligible players and a valid automatic lineup", () => {
    const state = createState("phase6-guest-eligible");
    const result = materializeGuestOpponent({
      state,
      entrant: guest(74),
      data: data(),
    });
    const players = result.school.playerIds.map(
      (playerId) => result.temporaryState.players[playerId]!,
    );
    const eligible = players.filter(
      (player) => !player.injury && player.fatigue < 85,
    );

    expect(players.length).toBeGreaterThanOrEqual(12);
    expect(eligible.length).toBeGreaterThanOrEqual(7);
    expect(result.selection.rotation).toHaveLength(6);
    expect(result.selection.liberoPlayerId).not.toBeNull();
  });

  it.each([48, 72, 96, 112])(
    "keeps materialized school strength close to entrant strength %i",
    (seedStrength) => {
      const state = createState(`phase6-guest-strength-${seedStrength}`);
      const result = materializeGuestOpponent({
        state,
        entrant: guest(seedStrength),
        data: data(),
      });
      const actual = calculateTournamentSchoolStrength(
        result.temporaryState,
        result.school,
      );

      expect(Math.abs(actual - seedStrength)).toBeLessThanOrEqual(5);
    },
  );

  it("uses collision-safe temporary IDs and never mutates the original state", () => {
    const state = createState("phase6-guest-isolation");
    const before = structuredClone(state);
    const persistentSchoolIds = new Set(Object.keys(state.schools));
    const persistentPlayerIds = new Set(Object.keys(state.players));

    const result = materializeGuestOpponent({
      state,
      entrant: guest(),
      data: data(),
    });

    expect(state).toEqual(before);
    expect(persistentSchoolIds.has(result.school.id)).toBe(false);
    expect(
      result.school.playerIds.every(
        (playerId) => !persistentPlayerIds.has(playerId),
      ),
    ).toBe(true);
    expect(Object.keys(result.temporaryState.schools)).toHaveLength(
      Object.keys(state.schools).length + 1,
    );
    expect(Object.keys(result.temporaryState.players)).toHaveLength(
      Object.keys(state.players).length + result.school.playerIds.length,
    );
  });
});
