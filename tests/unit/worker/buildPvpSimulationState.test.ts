import { createDemoGame } from "../../../src/app/createDemoGame";
import type { GameState } from "../../../src/domain/model/GameState";
import type { Player } from "../../../src/domain/model/Player";
import type { TeamSelection } from "../../../src/domain/model/TeamSelection";
import { playerId } from "../../../src/domain/model/identifiers";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { PublishedPvpTeamSnapshot } from "../../../worker/data/PvPStore";
import { buildPvpSimulationState } from "../../../worker/pvp/buildPvpSimulationState";

function selectionFor(state: GameState): TeamSelection {
  return autoSelectTeam({ state, schoolId: state.userSchoolId });
}

function defenderSnapshot(
  state: GameState,
  selection: TeamSelection,
): PublishedPvpTeamSnapshot {
  const school = structuredClone(state.schools[state.userSchoolId]!);
  const players = Object.fromEntries(
    school.playerIds.map((id) => [id, structuredClone(state.players[id]!)]),
  ) as Record<string, Player>;

  return {
    id: "snapshot-defender",
    userId: "defender-user",
    sourceRevision: 8,
    sourceAcademicYear: state.calendar.academicYear,
    sourceYearIndex: state.yearIndex,
    school,
    players,
    teamSelection: structuredClone(selection),
    isActive: true,
    publishedAt: "2026-08-28T05:00:00.000Z",
  };
}

function allSelectionIds(selection: TeamSelection): string[] {
  return [
    ...selection.rotation.map((entry) => entry.playerId),
    ...(selection.liberoPlayerId ? [selection.liberoPlayerId] : []),
    ...selection.benchPlayerIds,
    ...selection.servingOrderPlayerIds,
    ...selection.substitutionPolicy.starterLockPlayerIds,
  ];
}

describe("buildPvpSimulationState", () => {
  it("namespaces identical school and player ids from different users", () => {
    const challengerState = createDemoGame();
    const defenderState = createDemoGame();
    const challengerSchool = challengerState.schools[challengerState.userSchoolId]!;
    const defenderSchool = defenderState.schools[defenderState.userSchoolId]!;

    expect(challengerSchool.id).toBe(defenderSchool.id);
    expect(challengerSchool.playerIds[0]).toBe(defenderSchool.playerIds[0]);

    const result = buildPvpSimulationState({
      challenger: {
        userId: "challenger-user",
        state: challengerState,
        teamSelection: selectionFor(challengerState),
      },
      defender: defenderSnapshot(defenderState, selectionFor(defenderState)),
    });

    expect(result.challengerSchoolId).not.toBe(result.defenderSchoolId);
    expect(result.challengerSchoolId).toBe(
      `challenger:challenger-user:${challengerSchool.id}`,
    );
    expect(result.defenderSchoolId).toBe(
      `defender:snapshot-defender:${defenderSchool.id}`,
    );

    const expectedPlayerCount =
      challengerSchool.playerIds.length + defenderSchool.playerIds.length;
    expect(Object.keys(result.state.players)).toHaveLength(expectedPlayerCount);
    expect(new Set(Object.keys(result.state.players)).size).toBe(
      expectedPlayerCount,
    );
  });

  it("remaps team selection, career, captain, and opponent tactic player references consistently", () => {
    const challengerState = createDemoGame();
    const defenderState = createDemoGame();
    const challengerSchool = challengerState.schools[challengerState.userSchoolId]!;
    const defenderSchool = defenderState.schools[defenderState.userSchoolId]!;
    const challengerSelection = selectionFor(challengerState);
    const defenderSelection = selectionFor(defenderState);
    const challengerOriginalCaptain = challengerSchool.playerIds[1]!;
    const defenderOriginalCaptain = defenderSchool.playerIds[2]!;
    const defenderTarget = defenderSchool.playerIds[0]!;
    const challengerTarget = challengerSchool.playerIds[3]!;

    challengerSchool.captainPlayerId = challengerOriginalCaptain;
    challengerSchool.tactics.serveTargetPlayerId = defenderTarget;
    defenderSchool.captainPlayerId = defenderOriginalCaptain;
    defenderSchool.tactics.serveTargetPlayerId = challengerTarget;

    const result = buildPvpSimulationState({
      challenger: {
        userId: "challenger-user",
        state: challengerState,
        teamSelection: challengerSelection,
      },
      defender: defenderSnapshot(defenderState, defenderSelection),
    });

    const challengerOutput = result.state.schools[result.challengerSchoolId]!;
    const defenderOutput = result.state.schools[result.defenderSchoolId]!;

    for (const id of allSelectionIds(result.challengerSelection)) {
      expect(id).toMatch(/^challenger:challenger-user:/);
    }
    for (const id of allSelectionIds(result.defenderSelection)) {
      expect(id).toMatch(/^defender:snapshot-defender:/);
    }

    expect(challengerOutput.captainPlayerId).toBe(
      playerId(`challenger:challenger-user:${challengerOriginalCaptain}`),
    );
    expect(defenderOutput.captainPlayerId).toBe(
      playerId(`defender:snapshot-defender:${defenderOriginalCaptain}`),
    );
    expect(challengerOutput.tactics.serveTargetPlayerId).toBe(
      playerId(`defender:snapshot-defender:${defenderTarget}`),
    );
    expect(defenderOutput.tactics.serveTargetPlayerId).toBe(
      playerId(`challenger:challenger-user:${challengerTarget}`),
    );

    for (const player of Object.values(result.state.players)) {
      expect([result.challengerSchoolId, result.defenderSchoolId]).toContain(
        player.career.schoolId,
      );
    }
  });

  it("normalizes condition fatigue and injury while preserving developed ability", () => {
    const challengerState = createDemoGame();
    const defenderState = createDemoGame();
    const challengerSchool = challengerState.schools[challengerState.userSchoolId]!;
    const defenderSchool = defenderState.schools[defenderState.userSchoolId]!;
    const challengerOriginalId = challengerSchool.playerIds[0]!;
    const defenderOriginalId = defenderSchool.playerIds[0]!;
    const challengerPlayer = challengerState.players[challengerOriginalId]!;
    const defenderPlayer = defenderState.players[defenderOriginalId]!;
    const challengerAbilities = structuredClone(challengerPlayer.abilities);
    const defenderAbilities = structuredClone(defenderPlayer.abilities);

    challengerPlayer.condition = 21;
    challengerPlayer.fatigue = 94;
    challengerPlayer.injury = {
      injuryId: "test-injury",
      severity: "severe",
      remainingWeeks: 8,
      recurrenceRisk: 75,
    };
    defenderPlayer.condition = 47;
    defenderPlayer.fatigue = 73;
    defenderPlayer.injury = {
      injuryId: "test-injury-2",
      severity: "moderate",
      remainingWeeks: 3,
      recurrenceRisk: 40,
    };

    const result = buildPvpSimulationState({
      challenger: {
        userId: "challenger-user",
        state: challengerState,
        teamSelection: selectionFor(challengerState),
      },
      defender: defenderSnapshot(defenderState, selectionFor(defenderState)),
    });

    const normalizedChallenger =
      result.state.players[
        playerId(`challenger:challenger-user:${challengerOriginalId}`)
      ]!;
    const normalizedDefender =
      result.state.players[
        playerId(`defender:snapshot-defender:${defenderOriginalId}`)
      ]!;

    expect(normalizedChallenger.condition).toBe(100);
    expect(normalizedChallenger.fatigue).toBe(0);
    expect(normalizedChallenger.injury).toBeNull();
    expect(normalizedChallenger.abilities).toEqual(challengerAbilities);

    expect(normalizedDefender.condition).toBe(100);
    expect(normalizedDefender.fatigue).toBe(0);
    expect(normalizedDefender.injury).toBeNull();
    expect(normalizedDefender.abilities).toEqual(defenderAbilities);
  });
});
