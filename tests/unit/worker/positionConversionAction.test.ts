import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { applyGameAction } from "../../../worker/game/applyGameAction";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase46-position-conversion-action",
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

  return {
    userId: "phase46-position-conversion-user",
    schoolDbId: "00000000-0000-4000-8000-000000000046",
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

describe("position conversion action", () => {
  it("starts and cancels a conversion through the authoritative game action", () => {
    const snapshot = createSnapshot();
    const playerId =
      snapshot.state.schools[snapshot.state.userSchoolId]!.playerIds[0]!;
    const player = snapshot.state.players[playerId]!;
    const targetPosition = player.preferredPosition === "S" ? "OH" : "S";

    const started = applyGameAction(snapshot, {
      type: "set-player-position-conversion",
      playerId,
      targetPosition,
    });

    expect(
      started.state.teamPlanning.positionConversionsByPlayerId?.[playerId],
    ).toEqual(
      expect.objectContaining({
        fromPosition: player.preferredPosition,
        targetPosition,
        completedWeeks: 0,
      }),
    );

    const cancelled = applyGameAction(
      {
        ...snapshot,
        state: started.state,
        teamSelection: started.teamSelection,
      },
      {
        type: "set-player-position-conversion",
        playerId,
        targetPosition: null,
      },
    );

    expect(
      cancelled.state.teamPlanning.positionConversionsByPlayerId?.[playerId],
    ).toBeUndefined();
    expect(cancelled.state.players[playerId]!.preferredPosition).toBe(
      player.preferredPosition,
    );
  });

  it("rejects converting a player to their current position", () => {
    const snapshot = createSnapshot();
    const playerId =
      snapshot.state.schools[snapshot.state.userSchoolId]!.playerIds[0]!;
    const player = snapshot.state.players[playerId]!;

    expect(() =>
      applyGameAction(snapshot, {
        type: "set-player-position-conversion",
        playerId,
        targetPosition: player.preferredPosition,
      }),
    ).toThrowError(/現在の本職と同じポジション/);
  });
});
