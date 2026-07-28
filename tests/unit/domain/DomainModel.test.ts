import {
  createDefaultGameSettings,
  createEmptyGameHistory,
} from "../../../src/domain/model/GameState";
import {
  eventId,
  matchId,
  playerId,
  schoolId,
} from "../../../src/domain/model/identifiers";
import {
  clampAbility,
  createAbilities,
} from "../../../src/domain/model/Player";

describe("domain identifiers", () => {
  it("creates branded identifiers from non-empty values", () => {
    expect(playerId("player-1")).toBe("player-1");
    expect(schoolId("school-1")).toBe("school-1");
    expect(eventId("event-1")).toBe("event-1");
    expect(matchId("match-1")).toBe("match-1");
  });

  it("rejects blank identifiers", () => {
    expect(() => playerId("   ")).toThrow("player id must not be empty");
    expect(() => schoolId("")).toThrow("school id must not be empty");
  });
});

describe("player abilities", () => {
  it("creates integer abilities inside the 0 to 100 range", () => {
    expect(createAbilities(45.6)).toEqual({
      spike: 46,
      jump: 46,
      receive: 46,
      serve: 46,
      set: 46,
      block: 46,
      speed: 46,
      stamina: 46,
      decision: 46,
      mental: 46,
    });
    expect(createAbilities(-10).spike).toBe(0);
    expect(createAbilities(150).spike).toBe(100);
  });

  it("clamps finite values and rejects invalid numbers", () => {
    expect(clampAbility(38.7)).toBe(39);
    expect(clampAbility(-1)).toBe(0);
    expect(clampAbility(101)).toBe(100);
    expect(() => clampAbility(Number.NaN)).toThrow(
      "ability value must be finite",
    );
  });
});

describe("game state defaults", () => {
  it("uses coaching-friendly default settings", () => {
    expect(createDefaultGameSettings()).toEqual({
      matchDisplayMode: "normal",
      matchPlaybackSpeed: 1,
      reducedMotion: false,
      confirmBeforeOfficialMatch: true,
      autosaveEnabled: true,
    });
  });

  it("creates independent empty history collections", () => {
    const first = createEmptyGameHistory();
    const second = createEmptyGameHistory();

    first.matches.push({
      matchId: matchId("match-1"),
      date: "2026-04-01",
      homeSchoolId: schoolId("home"),
      awaySchoolId: schoolId("away"),
      winnerSchoolId: schoolId("home"),
      homeSetsWon: 2,
      awaySetsWon: 0,
      tournamentId: null,
    });

    expect(second.matches).toEqual([]);
  });
});
