import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import type { AdvanceWeekOutcome } from "../../../src/domain/calendar/advanceWeekOutcome";
import { isWeeklyActionCompleted } from "../../../src/domain/calendar/weekProgression";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { gameActionRequestSchema } from "../../../worker/game/actionSchema";
import { applyServerGameAction } from "../../../worker/game/applyServerGameAction";

function createSnapshot(seed: string): {
  snapshot: CloudGameSnapshot;
  opponentId: string;
} {
  const state = createInitialGame({
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
  const opponent = Object.values(state.schools).find(
    (school) => school.id !== state.userSchoolId,
  );
  if (!opponent) throw new Error("opponent fixture missing");

  state.weeklySchedule.practiceMatch.scheduledOpponentId = opponent.id;
  state.weeklySchedule.practiceMatch.scheduledBy = "outgoing";

  return {
    opponentId: opponent.id,
    snapshot: {
      userId: "phase16-user",
      schoolDbId: "00000000-0000-4000-8000-000000000001",
      revision: 7,
      state,
      teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
    },
  };
}

function advanceWeekOutcome(
  result: ReturnType<typeof applyServerGameAction>,
): AdvanceWeekOutcome {
  const outcome = result.outcome as AdvanceWeekOutcome | undefined;
  if (!outcome) throw new Error("advance-week outcome missing");
  return outcome;
}

describe("Phase16 resumable practice match session", () => {
  it("accepts only the four high-level match commands in the game action schema", () => {
    const commands = [
      { type: "timeout" },
      {
        type: "set-match-tactics",
        plan: { serve: "aggressive", attack: "quick", block: "commit" },
      },
      {
        type: "substitute",
        outgoingPlayerId: "player-out",
        incomingPlayerId: "player-in",
      },
      { type: "continue" },
    ] as const;

    for (const command of commands) {
      expect(() =>
        gameActionRequestSchema.parse({
          operationId: `phase16-${command.type}`,
          revision: 7,
          action: { type: "match-command", command },
        }),
      ).not.toThrow();
    }

    expect(() =>
      gameActionRequestSchema.parse({
        operationId: "phase16-low-level-command",
        revision: 7,
        action: {
          type: "match-command",
          command: { type: "serve-target", targetPlayerId: null },
        },
      }),
    ).toThrow();
  });

  it("starts a scheduled practice match only to the first authoritative decision boundary", () => {
    const { snapshot, opponentId } = createSnapshot("phase16-practice-start");

    const result = applyServerGameAction(snapshot, { type: "advance-week" });
    const outcome = advanceWeekOutcome(result);
    const presentation = outcome.pendingMatchPresentation;

    expect(presentation?.kind).toBe("practice");
    expect(presentation?.simulation.analysis).toBeNull();
    expect(result.state.activeMatch).not.toBeNull();
    expect(result.state.activeMatch?.phase).toBe("coach-decision");
    expect(result.state.activeMatch?.pendingCoachCommandForSchoolId).toBe(
      result.state.userSchoolId,
    );
    expect(result.state.activeMatch?.runtime?.controlledSchoolId).toBe(
      result.state.userSchoolId,
    );
    expect(result.state.activeMatch?.runtime?.pendingDecisionReason).toMatch(
      /^(opponent-run|set-break)$/,
    );
    expect(result.state.activeMatch?.eventLog.at(-1)?.type).not.toBe("match-end");
    expect(result.state.randomCursor).toBe(result.state.activeMatch?.randomCursor);
    expect(isWeeklyActionCompleted(result.state, "practice-match")).toBe(false);
    expect(result.state.weeklySchedule.practiceMatch.scheduledOpponentId).toBe(
      opponentId,
    );
    expect(
      result.state.history.matches.some(
        (match) => match.id === result.state.activeMatch?.id,
      ),
    ).toBe(false);
  });

  it("captures pre-match lineup and tactics inside activeMatch without persisting either override", () => {
    const { snapshot } = createSnapshot("phase16-practice-overrides");
    const persistentSelection = structuredClone(snapshot.teamSelection);
    const persistentTactics = structuredClone(
      snapshot.state.schools[snapshot.state.userSchoolId]!.tactics,
    );
    const alternate = structuredClone(snapshot.teamSelection);
    const outgoing = alternate.rotation[0]!.playerId;
    const incoming = alternate.benchPlayerIds[0]!;
    alternate.rotation[0] = { ...alternate.rotation[0]!, playerId: incoming };
    alternate.benchPlayerIds = alternate.benchPlayerIds.map((playerId) =>
      playerId === incoming ? outgoing : playerId,
    );
    alternate.servingOrderPlayerIds = alternate.servingOrderPlayerIds.map(
      (playerId) => (playerId === outgoing ? incoming : playerId),
    );
    const tactics = {
      serve: "aggressive",
      attack: "quick",
      block: "commit",
    } as const;

    const result = applyServerGameAction(snapshot, {
      type: "advance-week",
      matchSelection: alternate,
      matchTactics: tactics,
    });

    expect(result.state.activeMatch?.runtime?.homeBaseSelection).toEqual(alternate);
    expect(result.state.activeMatch?.runtime?.homeTactics).toEqual(tactics);
    expect(result.teamSelection).toEqual(persistentSelection);
    expect(result.state.schools[result.state.userSchoolId]!.tactics).toEqual(
      persistentTactics,
    );
  });
});
