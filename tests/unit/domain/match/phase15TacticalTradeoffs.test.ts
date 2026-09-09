import { describe, expect, it } from "vitest";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import { simulateMatch } from "../../../../src/domain/match/simulateMatch";
import { createAbilities } from "../../../../src/domain/model/Player";
import type { TeamTactics } from "../../../../src/domain/model/School";
import { matchId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { applyMatchTacticPlan, type MatchTacticPlan } from "../../../../src/domain/team/matchTactics";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";

if (!gameDataBootstrap.ok) throw new Error(gameDataBootstrap.message);
const data = gameDataBootstrap.data;

const userSchool = {
  name: "戦術試験高校",
  shortName: "戦術試験",
  regionId: "region.test",
  coachName: "戦術 監督",
  uniform: { primary: "#173B52", secondary: "#F4F7F8", accent: "#D89A2B" },
};

function equalContext(seed: string) {
  const state = generateWorld({ seed: `world-${seed}`, userSchool, data });
  const homeSchoolId = state.userSchoolId;
  const awaySchoolId = Object.values(state.schools).find((school) => school.id !== homeSchoolId)!.id;
  const home = state.schools[homeSchoolId]!;
  const away = state.schools[awaySchoolId]!;

  home.coach = { ...home.coach, tactics: 70, leadership: 70 };
  away.coach = { ...home.coach };
  for (const playerId of [...home.playerIds, ...away.playerIds]) {
    const player = state.players[playerId]!;
    state.players[playerId] = {
      ...player,
      abilities: createAbilities(70),
      condition: 100,
      fatigue: 0,
      morale: 100,
      injury: null,
      positionAptitudes: { OH: 70, MB: 70, OP: 70, S: 70, L: 70 },
    };
  }

  return {
    state,
    homeSchoolId,
    awaySchoolId,
    homeSelection: autoSelectTeam({ state, schoolId: homeSchoolId }),
    awaySelection: autoSelectTeam({ state, schoolId: awaySchoolId }),
  };
}

function run(seed: string, homePlan: MatchTacticPlan, awayPlan: MatchTacticPlan, awayDefenseBias?: TeamTactics["defenseBias"]) {
  const context = equalContext(seed);
  const home = context.state.schools[context.homeSchoolId]!;
  const away = context.state.schools[context.awaySchoolId]!;
  home.tactics = applyMatchTacticPlan(home.tactics, homePlan);
  away.tactics = applyMatchTacticPlan(away.tactics, awayPlan);
  if (awayDefenseBias) away.tactics.defenseBias = awayDefenseBias;

  const before = structuredClone(context.state);
  const result = simulateMatch({
    state: context.state,
    id: matchId(`phase15-${seed}`),
    homeSchoolId: context.homeSchoolId,
    awaySchoolId: context.awaySchoolId,
    homeSelection: context.homeSelection,
    awaySelection: context.awaySelection,
    bestOfSets: 3,
    random: new SeededRandom(`match-${seed}`),
  });
  expect(context.state).toEqual(before);
  return { ...result, ...context };
}

function homeAttackPoints(result: ReturnType<typeof run>): number {
  return result.match.eventLog.filter(
    (event) => event.detailCode === "point.attack" && event.winnerSchoolId === result.homeSchoolId,
  ).length;
}

function homeServeStats(result: ReturnType<typeof run>) {
  const homeIds = new Set(result.state.schools[result.homeSchoolId]!.playerIds);
  const serves = result.match.eventLog.filter((event) => event.type === "serve" && event.actorPlayerId && homeIds.has(event.actorPlayerId));
  return {
    errors: serves.filter((event) => event.detailCode === "serve.error").length,
    aces: serves.filter((event) => event.detailCode === "serve.ace").length,
  };
}

const balanced: MatchTacticPlan = { serve: "balanced", attack: "balanced", block: "mixed" };

describe("Phase 15 tactical trade-offs", () => {
  it("makes quick attack perform better against read than commit block at equal strength", () => {
    let versusRead = 0;
    let versusCommit = 0;
    for (let index = 0; index < 24; index += 1) {
      const seed = `quick-block-${index}`;
      versusRead += homeAttackPoints(run(seed, { ...balanced, attack: "quick" }, { ...balanced, block: "read" }));
      versusCommit += homeAttackPoints(run(seed, { ...balanced, attack: "quick" }, { ...balanced, block: "commit" }));
    }
    expect(versusRead).toBeGreaterThan(versusCommit);
  });

  it("removes an unconditional block-system hierarchy for balanced attack", () => {
    const totals = { commit: 0, mixed: 0, read: 0 };
    for (let index = 0; index < 20; index += 1) {
      const seed = `balanced-block-${index}`;
      totals.commit += homeAttackPoints(run(seed, balanced, { ...balanced, block: "commit" }));
      totals.mixed += homeAttackPoints(run(seed, balanced, { ...balanced, block: "mixed" }));
      totals.read += homeAttackPoints(run(seed, balanced, { ...balanced, block: "read" }));
    }
    expect(Math.max(...Object.values(totals)) - Math.min(...Object.values(totals))).toBeLessThanOrEqual(2);
  });

  it("does not give defenseBias a hidden flat simulation bonus", () => {
    for (let index = 0; index < 8; index += 1) {
      const seed = `defense-bias-${index}`;
      const line = run(seed, balanced, balanced, "line");
      const balancedBias = run(seed, balanced, balanced, "balanced");
      expect(line.match).toEqual(balancedBias.match);
      expect(line.analysis).toEqual(balancedBias.analysis);
    }
  });

  it("keeps the serve axis as a risk/reward trade-off without mutating state", () => {
    const safe = { errors: 0, aces: 0 };
    const aggressive = { errors: 0, aces: 0 };
    for (let index = 0; index < 24; index += 1) {
      const seed = `serve-profile-${index}`;
      const safeStats = homeServeStats(run(seed, { ...balanced, serve: "safe" }, balanced));
      const aggressiveStats = homeServeStats(run(seed, { ...balanced, serve: "aggressive" }, balanced));
      safe.errors += safeStats.errors;
      safe.aces += safeStats.aces;
      aggressive.errors += aggressiveStats.errors;
      aggressive.aces += aggressiveStats.aces;
    }
    expect(safe.errors).toBeLessThan(aggressive.errors);
    expect(aggressive.aces).toBeGreaterThan(safe.aces);
  });
});
