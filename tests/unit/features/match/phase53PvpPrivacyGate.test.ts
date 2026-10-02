import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { playerId } from "../../../../src/domain/model/identifiers";
import type { PvpChallengeInProgressResponse } from "../../../../src/domain/pvp/pvpContracts";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { buildLiveMatchIntelligence } from "../../../../src/features/match/liveMatchIntelligence";
import { buildPvpMatchScreenPresentation } from "../../../../src/features/match/pvpMatchPresentation";

describe("Phase53 PvP live intelligence privacy gate", () => {
  it("derives only team flow from public PvP events and never invents opponent player stats", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const response: PvpChallengeInProgressResponse = {
      status: "in-progress",
      operationId: "phase53-pvp-operation",
      revision: 53,
      seasonId: "2026-10",
      opponent: {
        snapshotId: "00000000-0000-4000-8000-000000000053",
        schoolName: "白波高校",
        schoolShortName: "白波",
      },
      segment: {
        status: "in-progress",
        operationId: "phase53-pvp-operation",
        matchId: "pvp:phase53-privacy",
        phase: "coach-decision",
        currentSetNumber: 1,
        challengerSetsWon: 0,
        defenderSetsWon: 0,
        currentScore: { challenger: 8, defender: 11 },
        challengerSelection: selection,
        challengerTactics: {
          serve: "balanced",
          attack: "balanced",
          block: "read",
        },
        opponentTargets: [
          {
            playerId: playerId("pvp-public:r1"),
            firstName: "太郎",
            lastName: "白波",
            preferredPosition: "OH",
            role: "court",
          },
          {
            playerId: playerId("pvp-public:libero"),
            firstName: "守",
            lastName: "白波",
            preferredPosition: "L",
            role: "libero",
          },
        ],
        timeoutAvailable: true,
        sets: [],
        pendingDecisionReason: "opponent-run",
        events: [
          {
            sequence: 1,
            type: "point",
            setNumber: 1,
            challengerScore: 8,
            defenderScore: 9,
            winner: "defender",
            detailCode: "point.attack",
          },
          {
            sequence: 2,
            type: "point",
            setNumber: 1,
            challengerScore: 8,
            defenderScore: 10,
            winner: "defender",
            detailCode: "point.block",
          },
          {
            sequence: 3,
            type: "point",
            setNumber: 1,
            challengerScore: 8,
            defenderScore: 11,
            winner: "defender",
            detailCode: "point.serve-ace",
          },
        ],
      },
    };

    const presentation = buildPvpMatchScreenPresentation(
      state.userSchoolId,
      response,
    );
    const match = presentation.result.match;

    expect(match.awaySelection.rotation).toEqual([]);
    expect(
      match.eventLog.every(
        (event) =>
          event.actorPlayerId === null && event.targetPlayerId === null,
      ),
    ).toBe(true);

    const intelligence = buildLiveMatchIntelligence({
      state,
      match,
      userSchoolId: state.userSchoolId,
      visibleEventSequence: 3,
    });

    expect(intelligence.opponentPlayers).toEqual([]);
    expect(intelligence.pointFlow.trailingOpponentPoints).toBe(3);
    expect(intelligence.insights).toHaveLength(1);
    expect(intelligence.insights[0]).toMatchObject({
      kind: "opponent-run",
      suggestedCommand: "timeout",
      targetPlayerId: null,
    });
    expect(
      intelligence.insights.some(
        (insight) =>
          insight.kind === "danger-attacker" ||
          insight.kind === "receiver-under-pressure",
      ),
    ).toBe(false);

    const serialized = JSON.stringify(intelligence);
    expect(serialized).not.toContain("pvp-public:");
    expect(serialized).not.toContain("白波 太郎");
    expect(serialized).not.toContain("abilities");
    expect(serialized).not.toContain("fatigue");
    expect(serialized).not.toContain("condition");
  });
});
