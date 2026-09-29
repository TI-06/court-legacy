import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { applyPreMatchPlayerRequests, selectPreMatchPlayerRequests } from "../../../src/domain/match/preMatchPlayerRequests";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";

describe("pre-match player requests", () => {
  it("surfaces existing player concerns for match preparation", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const benchPlayerId = selection.benchPlayerIds.find(
      (playerId) => state.players[playerId]?.preferredPosition !== "L",
    );
    expect(benchPlayerId).toBeDefined();

    state.teamDynamics.recentOfficialMatchesTracked = 4;
    state.teamDynamics.playerConcerns[benchPlayerId!] = [
      { code: "playing-time", severity: 3 },
    ];

    const requests = selectPreMatchPlayerRequests(state);

    expect(requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: benchPlayerId,
          code: "playing-time",
          title: "出場機会への不満",
          actionable: true,
        }),
      ]),
    );
  });

  it("moves a bench player with a playing-time request into the active lineup", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const benchPlayerId = selection.benchPlayerIds.find(
      (playerId) => state.players[playerId]?.preferredPosition !== "L",
    );
    expect(benchPlayerId).toBeDefined();

    state.teamDynamics.recentOfficialMatchesTracked = 4;
    state.teamDynamics.playerConcerns[benchPlayerId!] = [
      { code: "playing-time", severity: 3 },
    ];

    const next = applyPreMatchPlayerRequests(state, selection);
    const activeIds = new Set([
      ...next.rotation.map((assignment) => assignment.playerId),
      ...(next.liberoPlayerId ? [next.liberoPlayerId] : []),
    ]);

    expect(activeIds.has(benchPlayerId!)).toBe(true);
    expect(selection.benchPlayerIds).toContain(benchPlayerId);
  });

  it("removes an injured active player when injury-overuse is raised", () => {
    const state = createDemoGame();
    const selection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const activePlayerId = selection.rotation[0]!.playerId;
    state.players[activePlayerId] = {
      ...state.players[activePlayerId]!,
      injury: {
        injuryId: "ankle-sprain",
        severity: "moderate",
        remainingWeeks: 2,
        recurrenceRisk: 20,
      },
    };
    state.teamDynamics.recentOfficialMatchesTracked = 4;
    state.teamDynamics.playerConcerns[activePlayerId] = [
      { code: "injury-overuse", severity: 2 },
    ];

    const next = applyPreMatchPlayerRequests(state, selection);

    expect(
      next.rotation.some((assignment) => assignment.playerId === activePlayerId),
    ).toBe(false);
    expect(next.benchPlayerIds).toContain(activePlayerId);
  });
});
