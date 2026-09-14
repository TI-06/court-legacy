import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  buildPlayerConcernGuidance,
  selectPlayerConcernGuidance,
} from "../../../../src/domain/dynamics/playerConcernGuidance";
import type { PlayerConcern } from "../../../../src/domain/dynamics/teamDynamicsTypes";
import {
  matchId,
  type GameDate,
} from "../../../../src/domain/model/identifiers";

function firstUserPlayer(state: ReturnType<typeof createDemoGame>) {
  const school = state.schools[state.userSchoolId]!;
  return state.players[school.playerIds[0]!]!;
}

function setConcern(
  state: ReturnType<typeof createDemoGame>,
  concern: PlayerConcern,
) {
  const player = firstUserPlayer(state);
  state.teamDynamics.playerConcerns[player.id] = [concern];
  return player;
}

describe("player concern guidance", () => {
  it("explains a zero-usage playing-time concern with current progress and an official-match resolution path", () => {
    const state = createDemoGame();
    const player = setConcern(state, { code: "playing-time", severity: 3 });
    state.teamDynamics.recentOfficialMatchesTracked = 4;
    state.teamDynamics.recentOfficialStarterCounts[player.id] = 0;

    const [guidance] = selectPlayerConcernGuidance(state, player.id);

    expect(guidance).toMatchObject({
      code: "playing-time",
      severity: 3,
      title: "出場機会への不満",
      status: "needs-action",
    });
    expect(guidance?.reason).toContain("直近4試合");
    expect(guidance?.progressLabel).toContain("0/4");
    expect(guidance?.resolution).toContain("公式戦");
  });

  it("marks a still-active playing-time concern as improving after recent official usage", () => {
    const state = createDemoGame();
    const player = setConcern(state, { code: "playing-time", severity: 2 });
    state.teamDynamics.recentOfficialMatchesTracked = 4;
    state.teamDynamics.recentOfficialStarterCounts[player.id] = 1;

    const guidance = buildPlayerConcernGuidance(
      state,
      player.id,
      state.teamDynamics.playerConcerns[player.id]![0]!,
    );

    expect(guidance.status).toBe("improving");
    expect(guidance.progressLabel).toContain("1/4");
    expect(guidance.resolution).not.toMatch(/あと\d+試合/);
  });

  it("explains role mismatch using the current role and starter-or-ace usage", () => {
    const state = createDemoGame();
    const player = setConcern(state, { code: "role-mismatch", severity: 2 });
    state.teamDynamics.playerRoles[player.id] = "rotation";

    const guidance = selectPlayerConcernGuidance(state, player.id)[0]!;

    expect(guidance.title).toBe("役割への不満");
    expect(guidance.reason).toContain("ローテーション");
    expect(guidance.resolution).toMatch(/先発|エース/);
    expect(guidance.progressLabel).toContain("現在の役割");
  });

  it("explains injury overuse with injury status, recent usage, and a rest path", () => {
    const state = createDemoGame();
    const player = setConcern(state, { code: "injury-overuse", severity: 2 });
    state.players[player.id] = {
      ...player,
      injury: {
        injuryId: "phase20-test-injury",
        severity: "moderate",
        remainingWeeks: 2,
        recurrenceRisk: 30,
      },
    };
    state.teamDynamics.recentOfficialMatchesTracked = 4;
    state.teamDynamics.recentOfficialStarterCounts[player.id] = 1;

    const guidance = selectPlayerConcernGuidance(state, player.id)[0]!;

    expect(guidance.title).toBe("怪我中の起用負荷");
    expect(guidance.reason).toContain("怪我");
    expect(guidance.progressLabel).toContain("1/4");
    expect(guidance.resolution).toMatch(/起用しない|休養/);
  });

  it("explains a three-loss team slump and that an official win breaks the condition", () => {
    const state = createDemoGame();
    const player = setConcern(state, { code: "team-slump", severity: 1 });
    const opponent = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;

    for (let index = 0; index < 3; index += 1) {
      state.history.matches.push({
        matchId: matchId(`phase20-slump-${index}`),
        date: `2026-0${index + 4}-01` as GameDate,
        homeSchoolId: state.userSchoolId,
        awaySchoolId: opponent.id,
        winnerSchoolId: opponent.id,
        homeSetsWon: 1,
        awaySetsWon: 2,
        tournamentId: `official:phase20-slump-${index}`,
      });
    }

    const guidance = selectPlayerConcernGuidance(state, player.id)[0]!;

    expect(guidance.title).toBe("チーム不調への不満");
    expect(guidance.reason).toContain("3連敗");
    expect(guidance.progressLabel).toContain("公式戦3連敗");
    expect(guidance.resolution).toContain("公式戦で勝利");
  });
});
