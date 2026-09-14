import { gameDataBootstrap } from "../../data/gameData";
import { generateWorld } from "../../domain/generation/generateWorld";
import {
  decideCpuCoachCommand,
  type CpuCoachPublicView,
} from "../../domain/match/cpuCoachPolicy";
import { simulateMatch } from "../../domain/match/simulateMatch";
import { createAbilities } from "../../domain/model/Player";
import type { TeamTactics } from "../../domain/model/School";
import { matchId, type PlayerId } from "../../domain/model/identifiers";
import { SeededRandom } from "../../domain/random/SeededRandom";
import {
  applyMatchTacticPlan,
  type MatchTacticPlan,
} from "../../domain/team/matchTactics";
import { autoSelectTeam } from "../../domain/team/autoSelectTeam";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}
const data = gameDataBootstrap.data;

const USER_SCHOOL = {
  name: "戦術検証高校",
  shortName: "戦術検証",
  regionId: "region.test",
  coachName: "戦術 監督",
  uniform: {
    primary: "#173B52",
    secondary: "#F4F7F8",
    accent: "#D89A2B",
  },
};

const BALANCED: MatchTacticPlan = {
  serve: "balanced",
  attack: "balanced",
  block: "mixed",
};
const QUICK: MatchTacticPlan = { ...BALANCED, attack: "quick" };
const QUICK_IDENTITY: MatchTacticPlan = {
  serve: "aggressive",
  attack: "quick",
  block: "commit",
};
const SIDE_IDENTITY: MatchTacticPlan = {
  serve: "safe",
  attack: "side",
  block: "read",
};

export interface TacticalMatrixReport {
  neutralWinRate: number;
  favorableWinRate: number;
  unfavorableWinRate: number;
  strongerDisadvantagedWinRate: number;
  planAverageWinRates: {
    balanced: number;
    quick: number;
    side: number;
  };
  cpuTier0CounterWinRate: number;
  cpuTier3CounterWinRate: number;
  cpuTier0NeutralWinRate: number;
  cpuTier3NeutralWinRate: number;
}

export interface TacticalMatrixResult {
  report: TacticalMatrixReport;
  summary: string;
}

interface SeriesInput {
  seed: string;
  matches: number;
  focalPlan: MatchTacticPlan;
  opponentPlan: MatchTacticPlan;
  focalAbility?: number;
  opponentAbility?: number;
  focalDefenseBias?: TeamTactics["defenseBias"];
  opponentDefenseBias?: TeamTactics["defenseBias"];
}

function standardizeSchoolPlayers(
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
  const userSchoolId = state.userSchoolId;
  const rivalSchoolId = Object.values(state.schools).find(
    (school) => school.id !== userSchoolId,
  )!.id;
  const homeSchoolId = userSchoolId;
  const awaySchoolId = rivalSchoolId;
  const home = state.schools[homeSchoolId]!;
  const away = state.schools[awaySchoolId]!;
  const focalAbility = input.focalAbility ?? 70;
  const opponentAbility = input.opponentAbility ?? 70;

  const homeAbility = focalIsHome ? focalAbility : opponentAbility;
  const awayAbility = focalIsHome ? opponentAbility : focalAbility;
  const homePlan = focalIsHome ? input.focalPlan : input.opponentPlan;
  const awayPlan = focalIsHome ? input.opponentPlan : input.focalPlan;
  const homeDefense = focalIsHome
    ? input.focalDefenseBias
    : input.opponentDefenseBias;
  const awayDefense = focalIsHome
    ? input.opponentDefenseBias
    : input.focalDefenseBias;

  home.coach = { ...home.coach, tactics: 70, leadership: 70 };
  away.coach = { ...home.coach };
  home.tactics = applyMatchTacticPlan(home.tactics, homePlan);
  away.tactics = applyMatchTacticPlan(away.tactics, awayPlan);
  home.tactics.serveTargetPlayerId = null;
  away.tactics.serveTargetPlayerId = null;
  if (homeDefense) home.tactics.defenseBias = homeDefense;
  if (awayDefense) away.tactics.defenseBias = awayDefense;

  standardizeSchoolPlayers(state, home.playerIds, homeAbility);
  standardizeSchoolPlayers(state, away.playerIds, awayAbility);
  const homeSelection = autoSelectTeam({ state, schoolId: homeSchoolId });
  const awaySelection = autoSelectTeam({ state, schoolId: awaySchoolId });

  const result = simulateMatch({
    state,
    id: matchId(
      `phase19-matrix-${input.seed}-${pairIndex}-${focalIsHome ? "h" : "a"}`,
    ),
    homeSchoolId,
    awaySchoolId,
    homeSelection,
    awaySelection,
    bestOfSets: 3,
    random: new SeededRandom(`${input.seed}.match.${pairIndex}`),
  });
  const winnerSchoolId =
    result.match.homeSetsWon > result.match.awaySetsWon
      ? homeSchoolId
      : awaySchoolId;
  const focalSchoolId = focalIsHome ? homeSchoolId : awaySchoolId;
  return winnerSchoolId === focalSchoolId;
}

function runMirroredSeries(input: SeriesInput): number {
  const evenMatches = Math.max(2, Math.floor(input.matches / 2) * 2);
  let wins = 0;
  for (let pairIndex = 0; pairIndex < evenMatches / 2; pairIndex += 1) {
    if (runOne(input, pairIndex, true)) wins += 1;
    if (runOne(input, pairIndex, false)) wins += 1;
  }
  return wins / evenMatches;
}

function policyPlan(
  tier: 0 | 3,
  opponentPlan: MatchTacticPlan,
): MatchTacticPlan {
  const ownPlan = BALANCED;
  const view: CpuCoachPublicView = {
    schoolId: "school.cpu" as CpuCoachPublicView["schoolId"],
    opponentSchoolId:
      "school.opponent" as CpuCoachPublicView["opponentSchoolId"],
    archetypeId: "balanced",
    reputation: tier === 3 ? "elite" : "unknown",
    coachTactics: tier === 3 ? 90 : 20,
    ownPlan,
    opponentPlan,
    score: { own: 18, opponent: 20 },
    setNumber: 1,
    ownSetsWon: 0,
    opponentSetsWon: 1,
    runLength: 0,
    runWinnerSchoolId: null,
    timeoutAvailable: true,
    publicStats: {
      ownAces: 1,
      ownServeErrors: 1,
      opponentAces: 1,
      ownAttackPoints: 8,
      opponentAttackPoints: 10,
      ownBlockPoints: 2,
      opponentBlockPoints: 2,
    },
  };
  const command = decideCpuCoachCommand(view, "set-break");
  return command.type === "set-match-tactics" ? command.plan : ownPlan;
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function runTacticalMatrix(input: {
  seed: string;
  matchesPerSeries?: number;
}): TacticalMatrixResult {
  const matches = Math.max(24, input.matchesPerSeries ?? 48);
  const matrixMatches = Math.max(24, Math.floor((matches * 0.75) / 2) * 2);
  const series = (
    label: string,
    focalPlan: MatchTacticPlan,
    opponentPlan: MatchTacticPlan,
    options: Partial<SeriesInput> = {},
  ) =>
    runMirroredSeries({
      seed: `${input.seed}.${label}`,
      matches,
      focalPlan,
      opponentPlan,
      ...options,
    });

  const neutralWinRate = series("neutral", BALANCED, BALANCED);
  const favorableWinRate = series("favorable", QUICK, {
    ...BALANCED,
    block: "read",
  });
  const unfavorableWinRate = series("unfavorable", QUICK, {
    ...BALANCED,
    block: "commit",
  });
  const strongerDisadvantagedWinRate = series(
    "stronger-disadvantaged",
    QUICK,
    { ...BALANCED, block: "commit" },
    { focalAbility: 80, opponentAbility: 70 },
  );

  const identities = {
    balanced: BALANCED,
    quick: QUICK_IDENTITY,
    side: SIDE_IDENTITY,
  } as const;
  const planAverageWinRates = Object.fromEntries(
    Object.entries(identities).map(([ownName, ownPlan]) => {
      const rates = Object.entries(identities).map(
        ([opponentName, opponentPlan]) =>
          runMirroredSeries({
            seed: `${input.seed}.matrix.${ownName}.${opponentName}`,
            matches: matrixMatches,
            focalPlan: ownPlan,
            opponentPlan,
          }),
      );
      return [
        ownName,
        rounded(rates.reduce((sum, rate) => sum + rate, 0) / rates.length),
      ];
    }),
  ) as TacticalMatrixReport["planAverageWinRates"];

  const counterOpponent = { ...BALANCED, attack: "quick" } as MatchTacticPlan;
  const tier0CounterPlan = policyPlan(0, counterOpponent);
  const tier3CounterPlan = policyPlan(3, counterOpponent);
  const cpuTier0CounterWinRate = series(
    "cpu-counter-tier0",
    tier0CounterPlan,
    counterOpponent,
  );
  const cpuTier3CounterWinRate = series(
    "cpu-counter-tier3",
    tier3CounterPlan,
    counterOpponent,
  );

  const tier0NeutralPlan = policyPlan(0, BALANCED);
  const tier3NeutralPlan = policyPlan(3, BALANCED);
  const neutralSeed = `${input.seed}.cpu-neutral`;
  const cpuTier0NeutralWinRate = runMirroredSeries({
    seed: neutralSeed,
    matches,
    focalPlan: tier0NeutralPlan,
    opponentPlan: BALANCED,
  });
  const cpuTier3NeutralWinRate = runMirroredSeries({
    seed: neutralSeed,
    matches,
    focalPlan: tier3NeutralPlan,
    opponentPlan: BALANCED,
  });

  const report: TacticalMatrixReport = {
    neutralWinRate: rounded(neutralWinRate),
    favorableWinRate: rounded(favorableWinRate),
    unfavorableWinRate: rounded(unfavorableWinRate),
    strongerDisadvantagedWinRate: rounded(strongerDisadvantagedWinRate),
    planAverageWinRates,
    cpuTier0CounterWinRate: rounded(cpuTier0CounterWinRate),
    cpuTier3CounterWinRate: rounded(cpuTier3CounterWinRate),
    cpuTier0NeutralWinRate: rounded(cpuTier0NeutralWinRate),
    cpuTier3NeutralWinRate: rounded(cpuTier3NeutralWinRate),
  };

  const percent = (value: number) => `${Math.round(value * 100)}%`;
  return {
    report,
    summary: [
      `neutral=${percent(report.neutralWinRate)}`,
      `favorable=${percent(report.favorableWinRate)}`,
      `unfavorable=${percent(report.unfavorableWinRate)}`,
      `stronger-disadvantaged=${percent(report.strongerDisadvantagedWinRate)}`,
      `plan-avg(b/q/s)=${percent(report.planAverageWinRates.balanced)}/${percent(report.planAverageWinRates.quick)}/${percent(report.planAverageWinRates.side)}`,
      `cpu-counter(t0/t3)=${percent(report.cpuTier0CounterWinRate)}/${percent(report.cpuTier3CounterWinRate)}`,
      `cpu-neutral(t0/t3)=${percent(report.cpuTier0NeutralWinRate)}/${percent(report.cpuTier3NeutralWinRate)}`,
    ].join(" | "),
  };
}
