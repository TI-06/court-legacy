import type {
  MatchAnalysis,
  MatchAnalysisFactor,
  MatchEvent,
  MatchRuntimeState,
  MatchSetState,
  MatchState,
} from "../model/Match";
import type { GameState } from "../model/GameState";
import type { Player, PlayerAbilities, Position } from "../model/Player";
import type { School } from "../model/School";
import type { TeamSelection } from "../model/TeamSelection";
import type { MatchId, PlayerId, SchoolId } from "../model/identifiers";
import { getConditionMatchMultiplier } from "../player/playerCondition";
import { SeededRandom, type RandomSource } from "../random/SeededRandom";
import {
  applyMatchTacticPlan,
  deriveMatchTacticPlan,
  getAttackBlockMatchupPoints,
  type ServePlan,
} from "../team/matchTactics";
import { validateTeamSelection } from "../team/validateTeamSelection";

export interface SimulateMatchInput {
  state: GameState;
  id: MatchId;
  homeSchoolId: SchoolId;
  awaySchoolId: SchoolId;
  homeSelection: TeamSelection;
  awaySelection: TeamSelection;
  bestOfSets: 3 | 5;
  random: RandomSource;
  dynamicsReadinessByPlayerId?: Readonly<Partial<Record<PlayerId, number>>>;
}

export interface SimulateMatchResult {
  match: MatchState;
  analysis: MatchAnalysis;
}

export interface MatchStepResult {
  match: MatchState;
  analysis: MatchAnalysis | null;
}

export interface StartMatchInput extends SimulateMatchInput {
  controlledSchoolId: SchoolId;
}

export interface ResumeMatchInput {
  state: GameState;
  match: MatchState;
}

type MatchSide = "home" | "away";

interface SideRuntime {
  side: MatchSide;
  school: School;
  selection: TeamSelection;
}

interface RallyRuntime {
  setNumber: number;
  homeScore: number;
  awayScore: number;
  servingSide: MatchSide;
  home: SideRuntime;
  away: SideRuntime;
}

interface EventWriter {
  events: MatchEvent[];
  push: (
    type: MatchEvent["type"],
    runtime: RallyRuntime,
    actorPlayerId: PlayerId | null,
    targetPlayerId: PlayerId | null,
    winnerSchoolId: SchoolId | null,
    detailCode: string,
  ) => void;
}

interface TeamMatchMetrics {
  totalPoints: number;
  aces: number;
  serveErrors: number;
  attackPoints: number;
  blockPoints: number;
  defensePoints: number;
  readiness: number;
}

interface AbilityContext {
  timeoutBoost: MatchRuntimeState["timeoutBoost"];
}

const ATTACK_POSITIONS: readonly Position[] = ["OH", "MB", "OP", "S"];
const MAX_RALLIES_PER_SET = 2_000;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function applyDynamicsReadinessToState(
  state: GameState,
  readinessByPlayerId: Readonly<Partial<Record<PlayerId, number>>> | undefined,
): GameState {
  if (!readinessByPlayerId) {
    return state;
  }

  const players = { ...state.players };
  let changed = false;
  for (const [rawPlayerId, rawMultiplier] of Object.entries(
    readinessByPlayerId,
  )) {
    const playerId = rawPlayerId as PlayerId;
    const player = state.players[playerId];
    if (
      !player ||
      rawMultiplier === undefined ||
      !Number.isFinite(rawMultiplier)
    ) {
      continue;
    }
    const multiplier = clamp(rawMultiplier, 0.95, 1.05);
    players[playerId] = {
      ...player,
      abilities: {
        ...player.abilities,
        decision: clamp(player.abilities.decision * multiplier, 0, 100),
        mental: clamp(player.abilities.mental * multiplier, 0, 100),
      },
    };
    changed = true;
  }

  return changed ? { ...state, players } : state;
}

function cloneSelection(selection: TeamSelection): TeamSelection {
  return {
    rotation: selection.rotation.map((assignment) => ({ ...assignment })),
    liberoPlayerId: selection.liberoPlayerId,
    benchPlayerIds: [...selection.benchPlayerIds],
    servingOrderPlayerIds: [...selection.servingOrderPlayerIds],
    substitutionPolicy: {
      ...selection.substitutionPolicy,
      starterLockPlayerIds: [
        ...selection.substitutionPolicy.starterLockPlayerIds,
      ],
    },
  };
}

function opposite(side: MatchSide): MatchSide {
  return side === "home" ? "away" : "home";
}

function runtimeForSide(runtime: RallyRuntime, side: MatchSide): SideRuntime {
  return side === "home" ? runtime.home : runtime.away;
}

function schoolIdForSide(runtime: RallyRuntime, side: MatchSide): SchoolId {
  return runtimeForSide(runtime, side).school.id;
}

function playerOrThrow(state: GameState, playerId: PlayerId): Player {
  const player = state.players[playerId];
  if (!player) {
    throw new Error(`match selection references unknown player: ${playerId}`);
  }
  return player;
}

function rotationPlayers(state: GameState, selection: TeamSelection): Player[] {
  return [...selection.rotation]
    .sort((first, second) => first.slot - second.slot)
    .map((assignment) => playerOrThrow(state, assignment.playerId));
}

function activePlayers(state: GameState, selection: TeamSelection): Player[] {
  const players = rotationPlayers(state, selection);
  if (selection.liberoPlayerId) {
    players.push(playerOrThrow(state, selection.liberoPlayerId));
  }
  return players;
}

function readiness(player: Player): number {
  const injuryPenalty = player.injury ? 0.58 : 1;
  return getConditionMatchMultiplier(player.condition) * injuryPenalty;
}

function timeoutAbilityMultiplier(
  player: Player,
  ability: keyof PlayerAbilities,
  context: AbilityContext | undefined,
): number {
  const boost = context?.timeoutBoost;
  if (
    !boost ||
    boost.ralliesRemaining <= 0 ||
    player.career.schoolId !== boost.schoolId
  ) {
    return 1;
  }
  if (ability === "decision") {
    return 1.04;
  }
  if (ability === "mental") {
    return 1.05;
  }
  return 1;
}

function effectiveAbility(
  player: Player,
  ability: keyof PlayerAbilities,
  context?: AbilityContext,
): number {
  const base = player.abilities[ability] * readiness(player);
  const multiplier = timeoutAbilityMultiplier(player, ability, context);
  return multiplier === 1 ? base : clamp(base * multiplier, 0, 100);
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedPick<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  random: RandomSource,
): T {
  if (items.length === 0) {
    throw new Error("cannot select from an empty match collection");
  }

  const weights = items.map((item) => Math.max(0.001, weightOf(item)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = random.next() * total;

  for (let index = 0; index < items.length; index += 1) {
    cursor -= weights[index]!;
    if (cursor <= 0) {
      return items[index]!;
    }
  }

  return items.at(-1)!;
}

function bestPlayer(
  players: readonly Player[],
  scoreOf: (player: Player) => number,
): Player {
  const sorted = [...players].sort((first, second) => {
    const difference = scoreOf(second) - scoreOf(first);
    return difference !== 0 ? difference : first.id.localeCompare(second.id);
  });
  const player = sorted[0];
  if (!player) {
    throw new Error("match role has no available player");
  }
  return player;
}

function currentServer(state: GameState, selection: TeamSelection): Player {
  const serverId = selection.servingOrderPlayerIds[0];
  if (!serverId) {
    throw new Error("serving order has no current server");
  }
  return playerOrThrow(state, serverId);
}

function chooseReceiver(
  state: GameState,
  servingSchool: School,
  receivingSelection: TeamSelection,
  random: RandomSource,
  abilityContext?: AbilityContext,
): Player {
  const active = activePlayers(state, receivingSelection);
  const configuredTarget = servingSchool.tactics.serveTargetPlayerId;
  const configured = configuredTarget
    ? active.find((player) => player.id === configuredTarget)
    : undefined;

  if (configured && random.next() < 0.72) {
    return configured;
  }

  return weightedPick(
    active,
    (player) =>
      145 -
      effectiveAbility(player, "receive", abilityContext) -
      effectiveAbility(player, "speed", abilityContext) * 0.25,
    random,
  );
}

function chooseSetter(
  state: GameState,
  selection: TeamSelection,
  abilityContext?: AbilityContext,
): Player {
  return bestPlayer(rotationPlayers(state, selection), (player) => {
    const positionBonus = player.preferredPosition === "S" ? 35 : 0;
    return (
      effectiveAbility(player, "set", abilityContext) * 1.8 +
      effectiveAbility(player, "decision", abilityContext) * 0.7 +
      player.positionAptitudes.S * 0.8 +
      positionBonus
    );
  });
}

function attackPositionWeight(school: School, position: Position): number {
  const configured = school.tactics.attackDistribution[position] ?? 0;
  const tempoBonus =
    school.tactics.attackTempo === "fast"
      ? position === "MB"
        ? 18
        : 2
      : school.tactics.attackTempo === "slow"
        ? position === "OH" || position === "OP"
          ? 10
          : 1
        : 6;

  return Math.max(1, configured + tempoBonus);
}

function chooseAttacker(
  state: GameState,
  runtime: SideRuntime,
  random: RandomSource,
  abilityContext?: AbilityContext,
): Player {
  const rotation = rotationPlayers(state, runtime.selection);
  const candidates = rotation.filter((player) =>
    ATTACK_POSITIONS.includes(player.preferredPosition),
  );
  const pool = candidates.length > 0 ? candidates : rotation;

  return weightedPick(
    pool,
    (player) =>
      attackPositionWeight(runtime.school, player.preferredPosition) *
      (0.5 +
        effectiveAbility(player, "spike", abilityContext) / 140 +
        player.positionAptitudes[player.preferredPosition] / 260),
    random,
  );
}

function chooseBlocker(
  state: GameState,
  selection: TeamSelection,
  abilityContext?: AbilityContext,
): Player {
  return bestPlayer(rotationPlayers(state, selection), (player) => {
    const middleBonus = player.preferredPosition === "MB" ? 22 : 0;
    return (
      effectiveAbility(player, "block", abilityContext) * 1.7 +
      effectiveAbility(player, "jump", abilityContext) * 0.8 +
      player.positionAptitudes.MB * 0.55 +
      middleBonus
    );
  });
}

function chooseDigger(
  state: GameState,
  selection: TeamSelection,
  abilityContext?: AbilityContext,
): Player {
  if (selection.liberoPlayerId) {
    return playerOrThrow(state, selection.liberoPlayerId);
  }

  return bestPlayer(
    rotationPlayers(state, selection),
    (player) =>
      effectiveAbility(player, "receive", abilityContext) * 1.6 +
      effectiveAbility(player, "speed", abilityContext) * 0.7 +
      effectiveAbility(player, "decision", abilityContext) * 0.45,
  );
}

function rotateSelection(selection: TeamSelection): void {
  selection.rotation = selection.rotation.map((assignment) => ({
    ...assignment,
    slot: (assignment.slot === 1 ? 6 : assignment.slot - 1) as
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6,
  }));

  const firstServer = selection.servingOrderPlayerIds[0];
  if (firstServer) {
    selection.servingOrderPlayerIds = [
      ...selection.servingOrderPlayerIds.slice(1),
      firstServer,
    ];
  }
}

function createEventWriter(events: MatchEvent[] = []): EventWriter {
  return {
    events,
    push(
      type,
      runtime,
      actorPlayerId,
      targetPlayerId,
      winnerSchoolId,
      detailCode,
    ) {
      events.push({
        sequence: events.length + 1,
        type,
        setNumber: runtime.setNumber,
        homeScore: runtime.homeScore,
        awayScore: runtime.awayScore,
        actorPlayerId,
        targetPlayerId,
        winnerSchoolId,
        detailCode,
      });
    },
  };
}

function awardPoint(runtime: RallyRuntime, winner: MatchSide): void {
  if (winner === "home") {
    runtime.homeScore += 1;
  } else {
    runtime.awayScore += 1;
  }
}

function serveStrength(
  server: Player,
  school: School,
  abilityContext?: AbilityContext,
): number {
  return (
    effectiveAbility(server, "serve", abilityContext) * 0.72 +
    effectiveAbility(server, "mental", abilityContext) * 0.18 +
    school.coach.tactics * 0.1
  );
}

interface ServeTacticProfile {
  errorChance: number;
  aceChance: number;
  receiveQuality: number;
}

const SERVE_TACTIC_PROFILE: Record<ServePlan, ServeTacticProfile> = {
  safe: { errorChance: -0.016, aceChance: -0.012, receiveQuality: 2 },
  balanced: { errorChance: 0, aceChance: 0, receiveQuality: 0 },
  aggressive: { errorChance: 0.022, aceChance: 0.018, receiveQuality: -4 },
};

function receiveStrength(
  receiver: Player,
  school: School,
  abilityContext?: AbilityContext,
): number {
  return (
    effectiveAbility(receiver, "receive", abilityContext) * 0.7 +
    effectiveAbility(receiver, "speed", abilityContext) * 0.18 +
    effectiveAbility(receiver, "decision", abilityContext) * 0.12 +
    school.coach.tactics * 0.07 +
    school.coach.leadership * 0.04
  );
}

function blockMatchupAdjustment(
  attackingSchool: School,
  defendingSchool: School,
): number {
  const attackPlan = deriveMatchTacticPlan(attackingSchool.tactics).attack;
  const blockPlan = deriveMatchTacticPlan(defendingSchool.tactics).block;
  return -getAttackBlockMatchupPoints(attackPlan, blockPlan);
}

function simulateRally(
  state: GameState,
  runtime: RallyRuntime,
  random: RandomSource,
  writer: EventWriter,
  abilityContext?: AbilityContext,
): MatchSide {
  const serving = runtimeForSide(runtime, runtime.servingSide);
  const receivingSide = opposite(runtime.servingSide);
  const receiving = runtimeForSide(runtime, receivingSide);
  const server = currentServer(state, serving.selection);
  const receiver = chooseReceiver(
    state,
    serving.school,
    receiving.selection,
    random,
    abilityContext,
  );
  const serverStrength = serveStrength(server, serving.school, abilityContext);
  const receiverStrength = receiveStrength(
    receiver,
    receiving.school,
    abilityContext,
  );
  const servePlan = deriveMatchTacticPlan(serving.school.tactics).serve;
  const serveProfile = SERVE_TACTIC_PROFILE[servePlan];
  const serveErrorChance = clamp(
    0.024 + 50 * 0.00105 - serverStrength * 0.00024 + serveProfile.errorChance,
    0.012,
    0.17,
  );

  writer.push("serve", runtime, server.id, receiver.id, null, "serve.in-play");

  if (random.next() < serveErrorChance) {
    writer.events.at(-1)!.detailCode = "serve.error";
    awardPoint(runtime, receivingSide);
    writer.push(
      "point",
      runtime,
      receiver.id,
      server.id,
      receiving.school.id,
      "point.serve-error",
    );
    return receivingSide;
  }

  const aceChance = clamp(
    0.024 +
      (serverStrength - receiverStrength) * 0.00205 +
      50 * 0.00065 +
      serveProfile.aceChance,
    0.01,
    0.25,
  );
  if (random.next() < aceChance) {
    writer.events.at(-1)!.detailCode = "serve.ace";
    awardPoint(runtime, runtime.servingSide);
    writer.push(
      "point",
      runtime,
      server.id,
      receiver.id,
      serving.school.id,
      "point.serve-ace",
    );
    return runtime.servingSide;
  }

  const receiveVariation = (random.next() - 0.5) * 18;
  const receiveQuality =
    receiverStrength + serveProfile.receiveQuality + receiveVariation;
  writer.push(
    "receive",
    runtime,
    receiver.id,
    server.id,
    null,
    receiveQuality >= 72 ? "receive.perfect" : "receive.controlled",
  );

  const setter = chooseSetter(state, receiving.selection, abilityContext);
  const tempoModifier =
    receiving.school.tactics.attackTempo === "fast"
      ? 5
      : receiving.school.tactics.attackTempo === "slow"
        ? 2
        : 4;
  const setQuality =
    effectiveAbility(setter, "set", abilityContext) * 0.66 +
    effectiveAbility(setter, "decision", abilityContext) * 0.24 +
    receiveQuality * 0.28 +
    receiving.school.coach.tactics * 0.08 +
    tempoModifier +
    (random.next() - 0.5) * 12;
  const attacker = chooseAttacker(state, receiving, random, abilityContext);
  writer.push(
    "set",
    runtime,
    setter.id,
    attacker.id,
    null,
    setQuality >= 82 ? "set.ideal" : "set.available",
  );

  const attackPower =
    effectiveAbility(attacker, "spike", abilityContext) * 0.58 +
    effectiveAbility(attacker, "jump", abilityContext) * 0.19 +
    effectiveAbility(attacker, "decision", abilityContext) * 0.11 +
    attacker.positionAptitudes[attacker.preferredPosition] * 0.12 +
    setQuality * 0.35 +
    receiving.school.coach.tactics * 0.07 +
    (random.next() - 0.5) * 16;
  const blocker = chooseBlocker(state, serving.selection, abilityContext);
  const digger = chooseDigger(state, serving.selection, abilityContext);
  const blockPower =
    effectiveAbility(blocker, "block", abilityContext) * 0.62 +
    effectiveAbility(blocker, "jump", abilityContext) * 0.24 +
    effectiveAbility(blocker, "decision", abilityContext) * 0.14 +
    serving.school.coach.tactics * 0.08 +
    blockMatchupAdjustment(receiving.school, serving.school);
  const digPower =
    effectiveAbility(digger, "receive", abilityContext) * 0.58 +
    effectiveAbility(digger, "speed", abilityContext) * 0.25 +
    effectiveAbility(digger, "decision", abilityContext) * 0.17 +
    serving.school.coach.leadership * 0.07;

  writer.push(
    "attack",
    runtime,
    attacker.id,
    blocker.id,
    null,
    `attack.${attacker.preferredPosition.toLowerCase()}`,
  );

  const blockKillChance = clamp(
    0.035 + (blockPower - attackPower) * 0.00155,
    0.012,
    0.23,
  );
  if (random.next() < blockKillChance) {
    writer.push("block", runtime, blocker.id, attacker.id, null, "block.kill");
    awardPoint(runtime, runtime.servingSide);
    writer.push(
      "point",
      runtime,
      blocker.id,
      attacker.id,
      serving.school.id,
      "point.block",
    );
    return runtime.servingSide;
  }

  writer.push("block", runtime, blocker.id, attacker.id, null, "block.touch");
  const defensivePower = blockPower * 0.42 + digPower * 0.58;
  const attackPointChance = clamp(
    0.5 + (attackPower - defensivePower) * 0.0032,
    0.16,
    0.84,
  );

  if (random.next() < attackPointChance) {
    writer.push("dig", runtime, digger.id, attacker.id, null, "dig.failed");
    awardPoint(runtime, receivingSide);
    writer.push(
      "point",
      runtime,
      attacker.id,
      digger.id,
      receiving.school.id,
      "point.attack",
    );
    return receivingSide;
  }

  writer.push("dig", runtime, digger.id, attacker.id, null, "dig.counter");
  awardPoint(runtime, runtime.servingSide);
  writer.push(
    "point",
    runtime,
    digger.id,
    attacker.id,
    serving.school.id,
    "point.defense",
  );
  return runtime.servingSide;
}

function setIsComplete(
  setNumber: number,
  bestOfSets: 3 | 5,
  homeScore: number,
  awayScore: number,
): boolean {
  const target = setNumber === bestOfSets ? 15 : 25;
  return (
    Math.max(homeScore, awayScore) >= target &&
    Math.abs(homeScore - awayScore) >= 2
  );
}

function validateMatchInput(input: SimulateMatchInput): void {
  if (input.homeSchoolId === input.awaySchoolId) {
    throw new Error("match schools must be different");
  }
  if (!input.state.schools[input.homeSchoolId]) {
    throw new Error(`unknown home school: ${input.homeSchoolId}`);
  }
  if (!input.state.schools[input.awaySchoolId]) {
    throw new Error(`unknown away school: ${input.awaySchoolId}`);
  }

  const homeIssues = validateTeamSelection({
    state: input.state,
    schoolId: input.homeSchoolId,
    selection: input.homeSelection,
  });
  if (homeIssues.length > 0) {
    throw new Error(`invalid home selection: ${homeIssues[0]!.message}`);
  }
  const awayIssues = validateTeamSelection({
    state: input.state,
    schoolId: input.awaySchoolId,
    selection: input.awaySelection,
  });
  if (awayIssues.length > 0) {
    throw new Error(`invalid away selection: ${awayIssues[0]!.message}`);
  }
}

function matchMetrics(
  state: GameState,
  match: MatchState,
  schoolId: SchoolId,
  selection: TeamSelection,
): TeamMatchMetrics {
  const points = match.eventLog.filter(
    (event) => event.type === "point" && event.winnerSchoolId === schoolId,
  );
  const ownServeErrors = match.eventLog.filter(
    (event) =>
      event.type === "point" &&
      event.detailCode === "point.serve-error" &&
      event.winnerSchoolId !== schoolId,
  ).length;

  return {
    totalPoints: points.length,
    aces: points.filter((event) => event.detailCode === "point.serve-ace")
      .length,
    serveErrors: ownServeErrors,
    attackPoints: points.filter((event) => event.detailCode === "point.attack")
      .length,
    blockPoints: points.filter((event) => event.detailCode === "point.block")
      .length,
    defensePoints: points.filter(
      (event) => event.detailCode === "point.defense",
    ).length,
    readiness: Math.round(
      average(
        activePlayers(state, selection).map(
          (player) => readiness(player) * 100,
        ),
      ),
    ),
  };
}

function factor(
  code: string,
  impact: number,
  title: string,
  detail: string,
): MatchAnalysisFactor {
  return { code, impact: Math.round(impact), title, detail };
}

function createMatchAnalysis(
  state: GameState,
  match: MatchState,
): MatchAnalysis {
  const winnerSchoolId =
    match.homeSetsWon > match.awaySetsWon
      ? match.homeSchoolId
      : match.awaySchoolId;
  const loserSchoolId =
    winnerSchoolId === match.homeSchoolId
      ? match.awaySchoolId
      : match.homeSchoolId;
  const winnerSelection =
    winnerSchoolId === match.homeSchoolId
      ? match.homeSelection
      : match.awaySelection;
  const loserSelection =
    loserSchoolId === match.homeSchoolId
      ? match.homeSelection
      : match.awaySelection;
  const winner = matchMetrics(state, match, winnerSchoolId, winnerSelection);
  const loser = matchMetrics(state, match, loserSchoolId, loserSelection);
  const winnerName = state.schools[winnerSchoolId]!.shortName;
  const loserName = state.schools[loserSchoolId]!.shortName;
  const serveImpact =
    winner.aces - winner.serveErrors - (loser.aces - loser.serveErrors);
  const attackImpact = winner.attackPoints - loser.attackPoints;
  const defenseImpact =
    winner.blockPoints +
    winner.defensePoints -
    loser.blockPoints -
    loser.defensePoints;
  const readinessImpact = winner.readiness - loser.readiness;
  const principalFactors = [
    factor(
      "serve-pressure",
      serveImpact,
      "サーブで主導権を取った",
      `${winnerName}はエース${winner.aces}本・サーブミス${winner.serveErrors}本で、${loserName}より有利なサーブ収支を作りました。`,
    ),
    factor(
      "attack-efficiency",
      attackImpact,
      "攻撃決定力の差",
      `${winnerName}はアタックで${winner.attackPoints}点を獲得し、${loserName}の${loser.attackPoints}点を上回りました。`,
    ),
    factor(
      "block-defense",
      defenseImpact,
      "ブロックと守備の粘り",
      `${winnerName}はブロック${winner.blockPoints}点、守備から${winner.defensePoints}点を獲得しました。`,
    ),
    factor(
      "physical-readiness",
      readinessImpact,
      "試合時のコンディション",
      `${winnerName}の出場選手 readiness は${winner.readiness}、${loserName}は${loser.readiness}でした。`,
    ),
  ].sort((first, second) => Math.abs(second.impact) - Math.abs(first.impact));
  const recommendations = [
    factor(
      "improve-serve-receive",
      Math.max(1, winner.aces - loser.aces + loser.serveErrors),
      "サーブとサーブレシーブを整える",
      `相手のエース${winner.aces}本を減らし、自校のサーブミス${loser.serveErrors}本を抑える練習が有効です。`,
    ),
    factor(
      "improve-attack",
      Math.max(1, winner.attackPoints - loser.attackPoints),
      "攻撃の決定パターンを増やす",
      `アタック得点差は${Math.abs(winner.attackPoints - loser.attackPoints)}点でした。セッターと各攻撃位置の連携を優先してください。`,
    ),
    factor(
      "improve-defense",
      Math.max(
        1,
        winner.blockPoints +
          winner.defensePoints -
          loser.blockPoints -
          loser.defensePoints,
      ),
      "ブロック後の守備配置を改善する",
      "ブロックシステムと後衛守備の役割を合わせ、切り返し可能なディグを増やしてください。",
    ),
    factor(
      "improve-condition",
      Math.max(1, winner.readiness - loser.readiness),
      "疲労と状態を整える",
      `試合前 readiness は${loser.readiness}でした。回復練習と安全交代設定を見直してください。`,
    ),
  ].sort((first, second) => second.impact - first.impact);

  return {
    matchId: match.id,
    winnerSchoolId,
    principalFactors,
    recommendations: recommendations.slice(0, 3),
  };
}

function runtimeOrThrow(match: MatchState): MatchRuntimeState {
  if (!match.runtime) {
    throw new Error("resumable match runtime is missing");
  }
  return match.runtime;
}

function sideForSchool(match: MatchState, schoolId: SchoolId): MatchSide {
  if (schoolId === match.homeSchoolId) {
    return "home";
  }
  if (schoolId === match.awaySchoolId) {
    return "away";
  }
  throw new Error(`school is not part of match: ${schoolId}`);
}

function currentServingSide(match: MatchState): MatchSide {
  return sideForSchool(match, match.servingSchoolId);
}

function createInitialMatchState(
  input: SimulateMatchInput,
  controlledSchoolId: SchoolId | null,
): MatchState {
  validateMatchInput(input);
  if (
    controlledSchoolId !== null &&
    controlledSchoolId !== input.homeSchoolId &&
    controlledSchoolId !== input.awaySchoolId
  ) {
    throw new Error("controlled school must be one of the match schools");
  }

  const initialRandom = input.random.snapshot();
  const homeSelection = cloneSelection(input.homeSelection);
  const awaySelection = cloneSelection(input.awaySelection);
  const homeSchool = input.state.schools[input.homeSchoolId]!;
  const awaySchool = input.state.schools[input.awaySchoolId]!;

  return {
    id: input.id,
    homeSchoolId: input.homeSchoolId,
    awaySchoolId: input.awaySchoolId,
    homeSelection,
    awaySelection,
    bestOfSets: input.bestOfSets,
    phase: "set-in-progress",
    currentSetNumber: 1,
    homeSetsWon: 0,
    awaySetsWon: 0,
    sets: [],
    servingSchoolId: input.homeSchoolId,
    pendingCoachCommandForSchoolId: null,
    eventLog: [],
    randomSeed: initialRandom.seed,
    randomCursor: initialRandom.cursor,
    runtime: {
      controlledSchoolId,
      homeScore: 0,
      awayScore: 0,
      homeTactics: deriveMatchTacticPlan(homeSchool.tactics),
      awayTactics: deriveMatchTacticPlan(awaySchool.tactics),
      homeBaseSelection: cloneSelection(input.homeSelection),
      awayBaseSelection: cloneSelection(input.awaySelection),
      runWinnerSchoolId: null,
      runLength: 0,
      opponentRunDecisionConsumed: false,
      timeoutUsedSchoolIds: [],
      timeoutBoost: null,
      pendingDecisionReason: null,
      commandHistory: [],
      ralliesInCurrentSet: 0,
      dynamicsReadinessByPlayerId: input.dynamicsReadinessByPlayerId
        ? { ...input.dynamicsReadinessByPlayerId }
        : undefined,
    },
  };
}

function beginNextSet(match: MatchState): void {
  const runtime = runtimeOrThrow(match);
  match.currentSetNumber += 1;
  match.homeSelection = cloneSelection(runtime.homeBaseSelection);
  match.awaySelection = cloneSelection(runtime.awayBaseSelection);
  match.servingSchoolId =
    match.currentSetNumber % 2 === 1 ? match.homeSchoolId : match.awaySchoolId;
  match.phase = "set-in-progress";
  match.pendingCoachCommandForSchoolId = null;
  runtime.homeScore = 0;
  runtime.awayScore = 0;
  runtime.runWinnerSchoolId = null;
  runtime.runLength = 0;
  runtime.opponentRunDecisionConsumed = false;
  runtime.timeoutUsedSchoolIds = [];
  runtime.timeoutBoost = null;
  runtime.pendingDecisionReason = null;
  runtime.ralliesInCurrentSet = 0;
}

function interactiveSimulationState(
  state: GameState,
  match: MatchState,
): GameState {
  const runtime = runtimeOrThrow(match);
  const readinessState = applyDynamicsReadinessToState(
    state,
    runtime.dynamicsReadinessByPlayerId,
  );
  if (runtime.controlledSchoolId === null) {
    return readinessState;
  }

  const homeSchool = readinessState.schools[match.homeSchoolId];
  const awaySchool = readinessState.schools[match.awaySchoolId];
  if (!homeSchool || !awaySchool) {
    throw new Error("match school is missing from simulation state");
  }

  return {
    ...readinessState,
    schools: {
      ...readinessState.schools,
      [homeSchool.id]: {
        ...homeSchool,
        tactics: applyMatchTacticPlan(homeSchool.tactics, runtime.homeTactics),
      },
      [awaySchool.id]: {
        ...awaySchool,
        tactics: applyMatchTacticPlan(awaySchool.tactics, runtime.awayTactics),
      },
    },
  };
}

function updateScoringRun(match: MatchState, winnerSchoolId: SchoolId): void {
  const runtime = runtimeOrThrow(match);
  if (runtime.runWinnerSchoolId === winnerSchoolId) {
    runtime.runLength += 1;
    return;
  }
  runtime.runWinnerSchoolId = winnerSchoolId;
  runtime.runLength = 1;
}

function shouldOpenOpponentRunDecision(match: MatchState): boolean {
  const runtime = runtimeOrThrow(match);
  return (
    runtime.controlledSchoolId !== null &&
    !runtime.opponentRunDecisionConsumed &&
    runtime.runLength >= 4 &&
    runtime.runWinnerSchoolId !== null &&
    runtime.runWinnerSchoolId !== runtime.controlledSchoolId
  );
}

function decrementTimeoutBoost(match: MatchState): void {
  const runtime = runtimeOrThrow(match);
  if (!runtime.timeoutBoost) {
    return;
  }
  runtime.timeoutBoost.ralliesRemaining -= 1;
  if (runtime.timeoutBoost.ralliesRemaining <= 0) {
    runtime.timeoutBoost = null;
  }
}

function finishSet(
  match: MatchState,
  rallyRuntime: RallyRuntime,
  writer: EventWriter,
  simulationState: GameState,
): MatchStepResult | null {
  const runtime = runtimeOrThrow(match);
  const winnerSide: MatchSide =
    rallyRuntime.homeScore > rallyRuntime.awayScore ? "home" : "away";
  const winnerSchoolId = schoolIdForSide(rallyRuntime, winnerSide);

  if (winnerSide === "home") {
    match.homeSetsWon += 1;
  } else {
    match.awaySetsWon += 1;
  }

  const completedSet: MatchSetState = {
    setNumber: match.currentSetNumber,
    homeScore: rallyRuntime.homeScore,
    awayScore: rallyRuntime.awayScore,
    completed: true,
    winnerSchoolId,
  };
  match.sets.push(completedSet);
  writer.push(
    "set-end",
    rallyRuntime,
    null,
    null,
    winnerSchoolId,
    "set.complete",
  );
  runtime.timeoutBoost = null;

  const requiredSetWins = Math.ceil(match.bestOfSets / 2);
  if (
    match.homeSetsWon >= requiredSetWins ||
    match.awaySetsWon >= requiredSetWins
  ) {
    match.phase = "match-complete";
    match.pendingCoachCommandForSchoolId = null;
    runtime.pendingDecisionReason = null;
    writer.push(
      "match-end",
      rallyRuntime,
      null,
      null,
      winnerSchoolId,
      "match.complete",
    );
    return {
      match,
      analysis: createMatchAnalysis(simulationState, match),
    };
  }

  if (runtime.controlledSchoolId !== null) {
    match.phase = "coach-decision";
    match.pendingCoachCommandForSchoolId = runtime.controlledSchoolId;
    runtime.pendingDecisionReason = "set-break";
    return { match, analysis: null };
  }

  match.phase = "set-complete";
  beginNextSet(match);
  return null;
}

function runUntilBoundary(
  state: GameState,
  sourceMatch: MatchState,
  randomOverride?: RandomSource,
): MatchStepResult {
  const match = structuredClone(sourceMatch) as MatchState;
  const runtime = runtimeOrThrow(match);

  if (match.phase === "coach-decision") {
    throw new Error("unresolved coach decision must be handled before resume");
  }
  if (match.phase === "match-complete") {
    const simulationState = interactiveSimulationState(state, match);
    return { match, analysis: createMatchAnalysis(simulationState, match) };
  }
  if (match.phase === "set-complete") {
    beginNextSet(match);
  }
  if (match.phase !== "set-in-progress") {
    throw new Error(`cannot resume match from phase: ${match.phase}`);
  }

  const simulationState = interactiveSimulationState(state, match);
  const homeSchool = simulationState.schools[match.homeSchoolId]!;
  const awaySchool = simulationState.schools[match.awaySchoolId]!;
  const random =
    randomOverride ?? new SeededRandom(match.randomSeed, match.randomCursor);
  if (random.cursor !== match.randomCursor) {
    throw new Error("match random source cursor does not match resumable state");
  }
  const writer = createEventWriter(match.eventLog);

  while (true) {
    runtime.ralliesInCurrentSet += 1;
    if (runtime.ralliesInCurrentSet > MAX_RALLIES_PER_SET) {
      throw new Error("match set exceeded rally safety limit");
    }

    const rallyRuntime: RallyRuntime = {
      setNumber: match.currentSetNumber,
      homeScore: runtime.homeScore,
      awayScore: runtime.awayScore,
      servingSide: currentServingSide(match),
      home: {
        side: "home",
        school: homeSchool,
        selection: match.homeSelection,
      },
      away: {
        side: "away",
        school: awaySchool,
        selection: match.awaySelection,
      },
    };
    const servingBeforeRally = rallyRuntime.servingSide;
    const winner = simulateRally(
      simulationState,
      rallyRuntime,
      random,
      writer,
      { timeoutBoost: runtime.timeoutBoost },
    );

    if (winner !== servingBeforeRally) {
      const winnerRuntime = runtimeForSide(rallyRuntime, winner);
      rotateSelection(winnerRuntime.selection);
      writer.push(
        "rotation",
        rallyRuntime,
        winnerRuntime.selection.servingOrderPlayerIds[0] ?? null,
        null,
        winnerRuntime.school.id,
        "rotation.side-out",
      );
      rallyRuntime.servingSide = winner;
    }

    runtime.homeScore = rallyRuntime.homeScore;
    runtime.awayScore = rallyRuntime.awayScore;
    match.homeSelection = rallyRuntime.home.selection;
    match.awaySelection = rallyRuntime.away.selection;
    match.servingSchoolId = schoolIdForSide(
      rallyRuntime,
      rallyRuntime.servingSide,
    );
    match.randomCursor = random.cursor;
    decrementTimeoutBoost(match);

    const winnerSchoolId = schoolIdForSide(rallyRuntime, winner);
    updateScoringRun(match, winnerSchoolId);

    if (
      setIsComplete(
        match.currentSetNumber,
        match.bestOfSets,
        runtime.homeScore,
        runtime.awayScore,
      )
    ) {
      const completed = finishSet(match, rallyRuntime, writer, simulationState);
      if (completed) {
        return completed;
      }
      continue;
    }

    if (shouldOpenOpponentRunDecision(match)) {
      match.phase = "coach-decision";
      match.pendingCoachCommandForSchoolId = runtime.controlledSchoolId;
      runtime.pendingDecisionReason = "opponent-run";
      return { match, analysis: null };
    }
  }
}

export function startMatch(input: StartMatchInput): MatchStepResult {
  const match = createInitialMatchState(input, input.controlledSchoolId);
  return runUntilBoundary(input.state, match);
}

export function resumeMatch(input: ResumeMatchInput): MatchStepResult {
  return runUntilBoundary(input.state, input.match);
}

export function simulateMatch(input: SimulateMatchInput): SimulateMatchResult {
  const match = createInitialMatchState(input, null);
  const result = runUntilBoundary(input.state, match, input.random);
  if (!result.analysis || result.match.phase !== "match-complete") {
    throw new Error("non-interactive match did not complete");
  }

  const compatibilityMatch = { ...result.match };
  delete compatibilityMatch.runtime;
  return {
    match: compatibilityMatch,
    analysis: result.analysis,
  };
}
