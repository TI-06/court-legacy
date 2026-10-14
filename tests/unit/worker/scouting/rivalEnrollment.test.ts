import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceAcademicYear } from "../../../../src/domain/calendar/academicYearProgression";
import { playerId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../../worker/data/GameStore";
import type {
  ScoutingCandidatePool,
  ScoutingStore,
} from "../../../../worker/data/ScoutingStore";
import { resolveRivalIntake } from "../../../../worker/routes/gameAction";
import {
  buildServerScoutReports,
  rivalSigningSchoolId,
  scoutingCycleKey,
} from "../../../../worker/scouting/serverScoutingBoard";

function fixture() {
  const state = createDemoGame();
  state.date = "2027-03-31";
  state.calendar.currentDate = state.date;
  state.calendar.weekOfYear = 52;
  const cycleKey = scoutingCycleKey(state);
  state.recruiting = {
    cycleKey,
    scoutingSearchWeekOfYear: 1,
    committedCandidateIds: [],
  };

  const original =
    state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;
  const player = structuredClone(original);
  player.id = playerId("scout-rival-intake-test");
  player.grade = 1;
  player.potential = 100;
  player.tier = "elite";
  for (const key of Object.keys(player.abilities) as Array<
    keyof typeof player.abilities
  >) {
    player.abilities[key] = 100;
  }
  player.career = {
    ...player.career,
    schoolId: state.userSchoolId,
    enrolledYear: state.yearIndex + 1,
  };

  const pool: ScoutingCandidatePool = {
    userId: "rival-fixture",
    cycleKey,
    creationOperationId: "search-1",
    candidates: [{ player, middleSchoolAchievement: "national-event" }],
  };
  const store = {
    getCandidatePool: async () => pool,
    listCandidateInsights: async () => [],
  } as unknown as ScoutingStore;
  const snapshot = {
    userId: pool.userId,
    revision: 4,
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  } as CloudGameSnapshot;

  return { state, player, pool, store, snapshot };
}

describe("Phase59-2 rival enrollment", () => {
  it("uses a real rival school ID and enrolls the exact lost prospect", async () => {
    const { state, player, pool, store, snapshot } = fixture();
    const reports = buildServerScoutReports(state, pool);
    expect(reports[0]!.evaluationStars).toBe(5);
    const destination = rivalSigningSchoolId(state, reports[0]!);
    expect(destination).not.toBeNull();
    expect(destination).not.toBe(state.userSchoolId);

    const rivalIntake = await resolveRivalIntake(snapshot, pool.userId, store);
    expect(rivalIntake).toHaveLength(1);
    expect(rivalIntake[0]!.id).toBe(player.id);
    expect(rivalIntake[0]!.career.schoolId).toBe(destination);

    const result = advanceAcademicYear(
      state,
      gameData,
      new SeededRandom(state.seed, state.randomCursor),
      { rivalIntake },
    );
    expect(result.state.schools[destination!]!.playerIds).toContain(player.id);
    expect(result.state.players[player.id]!.grade).toBe(1);
    expect(result.state.players[player.id]!.career.schoolId).toBe(destination);
    expect(result.state.players[player.id]!.abilities).toEqual(
      player.abilities,
    );
    expect(result.summary.intakePlayerIdsBySchool[destination!]).toContain(
      player.id,
    );
    expect(result.state.schools[state.userSchoolId]!.playerIds).not.toContain(
      player.id,
    );
  });

  it("never assigns an already committed candidate to another school", async () => {
    const { state, player, pool, store, snapshot } = fixture();
    state.recruiting!.committedCandidateIds = [player.id];
    const rivalIntake = await resolveRivalIntake(snapshot, pool.userId, store);
    expect(rivalIntake).toEqual([]);
  });

  it("does not auto-enroll candidates without an expired deadline", async () => {
    const { state, pool, store, snapshot } = fixture();
    state.recruiting!.scoutingSearchWeekOfYear = state.calendar.weekOfYear;
    const rivalIntake = await resolveRivalIntake(snapshot, pool.userId, store);
    expect(rivalIntake).toEqual([]);
  });
});
