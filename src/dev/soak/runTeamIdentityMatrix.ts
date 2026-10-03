import { gameDataBootstrap } from "../../data/gameData";
import { generateWorld } from "../../domain/generation/generateWorld";
import { simulateMatch } from "../../domain/match/simulateMatch";
import { createAbilities } from "../../domain/model/Player";
import { matchId, type PlayerId } from "../../domain/model/identifiers";
import { SeededRandom } from "../../domain/random/SeededRandom";
import { autoSelectTeam } from "../../domain/team/autoSelectTeam";
import {
  applyMatchTacticPlan,
  type MatchTacticPlan,
} from "../../domain/team/matchTactics";
import type { TeamIdentityStyle } from "../../domain/team/teamPlanningTypes";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}
const data = gameDataBootstrap.data;

const USER_SCHOOL = {
  name: "哲学検証高校",
  shortName: "哲学検証",
  regionId: "region.test",
  coachName: "哲学 監督",
  uniform: {
    primary: "#173B52",
    secondary: "#F4F7F8",
    accent: "#D89A2B",
  },
};

const SERVE_BLOCK: MatchTacticPlan = {
  serve: "aggressive",
  attack: "balanced",
  block: "commit",
};

const CONTRADICTORY_SERVE_BLOCK: MatchTacticPlan = {
  serve: "safe",
  attack: "balanced",
  block: "read",
};

interface SeriesInput {
  seed: string;
  matches: number;
  mastery: number;
  style: TeamIdentityStyle;
  focalPlan: MatchTacticPlan;
  focalAbility?: number;
  opponentAbility?: number;
  enableIdentity?: boolean;
}

export interface TeamIdentityMatrixReport {
  baselineWinRate: number;
  masteredWinRate: number;
  masteredWinRateDelta: number;
  mismatchedMasteredWinRate: number;
  strongerOpponentWinRate: number;
}

export interface TeamIdentityMatrixResult {
  report: TeamIdentityMatrixReport;
  summary: string;
}

function standardizePlayers(
  state: ReturnType<typeof generateWorld>,
  playerIds: readonly PlayerId[],
  ability: number,
): void {
  for (const playerId of playerIds) {
    const player = state.players[playerId]!;
    state.players[playerId] = {
      ...player,
      abilities: createAbilities(ability),
      condition: 100,
      fatigue: 0,
      morale: 100,
      trust: 100,
      injury: null,
      traitIds: [],
      hiddenTraitIds: [],
      specialAbilityIds: [],
      matchConsistency: 50,
      bigMatch: 50,
      teamAdaptation: 100,
      positionAptitudes: {
        OH: ability,
        MB: ability,
        OP: ability,
        S: ability,
        L: ability,
      },
    };
  }
}

function runOne(
  input: SeriesInput,
  pairIndex: number,
  focalIsHome: boolean,
): boolean {
  const state = generateWorld({
    seed: `${input.seed}.world.${pairIndex}`,
    userSchool: USER_SCHOOL,
    data,
  });
  const focalSchoolId = state.userSchoolId;
  const opponentSchoolId = Object.values(state.schools).find(
    (school) => school.id !== focalSchoolId,
  )!.id;
  const focalSchool = state.schools[focalSchoolId]!;
  const opponentSchool = state.schools[opponentSchoolId]!;

  focalSchool.coach = {
    ...focalSchool.coach,
    tactics: 70,
    leadership: 70,
  };
  opponentSchool.coach = { ...focalSchool.coach };
  focalSchool.tactics = applyMatchTacticPlan(
    focalSchool.tactics,
    input.focalPlan,
  );
  opponentSchool.tactics = applyMatchTacticPlan(
    opponentSchool.tactics,
    input.focalPlan,
  );
  focalSchool.tactics.serveTargetPlayerId = null;
  opponentSchool.tactics.serveTargetPlayerId = null;
  focalSchool.tactics.defenseBias = "balanced";
  opponentSchool.tactics.defenseBias = "balanced";

  state.teamPlanning.teamIdentity = {
    style: input.style,
    mastery: input.mastery,
    weeksInStyle: 20,
    changeCount: 0,
  };

  standardizePlayers(state, focalSchool.playerIds, input.focalAbility ?? 70);
  standardizePlayers(
    state,
    opponentSchool.playerIds,
    input.opponentAbility ?? 70,
  );

  const homeSchoolId = focalIsHome ? focalSchoolId : opponentSchoolId;
  const awaySchoolId = focalIsHome ? opponentSchoolId : focalSchoolId;
  const result = simulateMatch({
    state,
    id: matchId(
      `phase56-identity-${input.seed}-${pairIndex}-${focalIsHome ? "h" : "a"}`,
    ),
    homeSchoolId,
    awaySchoolId,
    homeSelection: autoSelectTeam({ state, schoolId: homeSchoolId }),
    awaySelection: autoSelectTeam({ state, schoolId: awaySchoolId }),
    bestOfSets: 3,
    random: new SeededRandom(`${input.seed}.match.${pairIndex}`),
    ...(input.enableIdentity === false
      ? {}
      : { identityMasterySchoolId: focalSchoolId }),
  });

  const winnerSchoolId =
    result.match.homeSetsWon > result.match.awaySetsWon
      ? homeSchoolId
      : awaySchoolId;
  return winnerSchoolId === focalSchoolId;
}

function runMirroredSeries(input: SeriesInput): number {
  const matches = Math.max(2, Math.floor(input.matches / 2) * 2);
  let wins = 0;
  for (let pairIndex = 0; pairIndex < matches / 2; pairIndex += 1) {
    if (runOne(input, pairIndex, true)) wins += 1;
    if (runOne(input, pairIndex, false)) wins += 1;
  }
  return wins / matches;
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function runTeamIdentityMatrix(input: {
  seed: string;
  matchesPerSeries?: number;
}): TeamIdentityMatrixResult {
  const matches = Math.max(40, input.matchesPerSeries ?? 80);
  const baselineWinRate = runMirroredSeries({
    seed: `${input.seed}.baseline`,
    matches,
    mastery: 0,
    style: "serve-block",
    focalPlan: SERVE_BLOCK,
  });
  const masteredWinRate = runMirroredSeries({
    seed: `${input.seed}.baseline`,
    matches,
    mastery: 100,
    style: "serve-block",
    focalPlan: SERVE_BLOCK,
  });
  const mismatchedMasteredWinRate = runMirroredSeries({
    seed: `${input.seed}.mismatch`,
    matches,
    mastery: 100,
    style: "serve-block",
    focalPlan: CONTRADICTORY_SERVE_BLOCK,
  });
  const mismatchBaseline = runMirroredSeries({
    seed: `${input.seed}.mismatch`,
    matches,
    mastery: 0,
    style: "serve-block",
    focalPlan: CONTRADICTORY_SERVE_BLOCK,
  });
  const strongerOpponentWinRate = runMirroredSeries({
    seed: `${input.seed}.stronger-opponent`,
    matches,
    mastery: 100,
    style: "serve-block",
    focalPlan: SERVE_BLOCK,
    focalAbility: 70,
    opponentAbility: 78,
  });

  const report = {
    baselineWinRate: rounded(baselineWinRate),
    masteredWinRate: rounded(masteredWinRate),
    masteredWinRateDelta: rounded(masteredWinRate - baselineWinRate),
    mismatchedMasteredWinRate: rounded(
      mismatchedMasteredWinRate - mismatchBaseline,
    ),
    strongerOpponentWinRate: rounded(strongerOpponentWinRate),
  };

  const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;
  return {
    report,
    summary: [
      `baseline=${percent(report.baselineWinRate)}`,
      `mastered=${percent(report.masteredWinRate)}`,
      `delta=${percent(report.masteredWinRateDelta)}`,
      `mismatch-delta=${percent(report.mismatchedMasteredWinRate)}`,
      `vs+8=${percent(report.strongerOpponentWinRate)}`,
    ].join(" | "),
  };
}
