import type { MatchAnalysis, MatchAnalysisFactor, MatchEvent, MatchSetState, MatchState } from "../model/Match";
import type { Player, PlayerAbilities, Position } from "../model/Player";
import type { School } from "../model/School";
import type { TeamSelection } from "../model/TeamSelection";
import type { GameState } from "../model/GameState";
import type { MatchId, PlayerId, SchoolId } from "../model/identifiers";
import type { RandomSource } from "../random/SeededRandom";
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
}

export interface SimulateMatchResult {
  match: MatchState;
  analysis: MatchAnalysis;
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

const ATTACK_POSITIONS: readonly Position[] = ["OH", "MB", "OP", "S"];
const MAX_RALLIES_PER_SET = 2_000;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
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
  const conditionComponent = player.condition / 100;
  const fatigueComponent = (100 - player.fatigue) / 100;
  const injuryPenalty = player.injury ? 0.58 : 1;

  return clamp(
    (0.42 + conditionComponent * 0.43 + fatigueComponent * 0.28) *
      injuryPenalty,
    0.35,
    1.16,
  );
}

function effectiveAbility(
  player: Player,
  ability: keyof PlayerAbilities,
): number {
  return player.abilities[ability] * readiness(player);
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
      effectiveAbility(player, "receive") -
      effectiveAbility(player, "speed") * 0.25,
    random,
  );
}

function chooseSetter(state: GameState, selection: TeamSelection): Player {
  return bestPlayer(rotationPlayers(state, selection), (player) => {
    const positionBonus = player.preferredPosition === "S" ? 35 : 0;
    return (
      effectiveAbility(player, "set") * 1.8 +
      effectiveAbility(player, "decision") * 0.7 +
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
        effectiveAbility(player, "spike") / 140 +
        player.positionAptitudes[player.preferredPosition] / 260),
    random,
  );
}

function chooseBlocker(state: GameState, selection: TeamSelection): Player {
  return bestPlayer(rotationPlayers(state, selection), (player) => {
    const middleBonus = player.preferredPosition === "MB" ? 22 : 0;
    return (
      effectiveAbility(player, "block") * 1.7 +
      effectiveAbility(player, "jump") * 0.8 +
      player.positionAptitudes.MB * 0.55 +
      middleBonus
    );
  });
}

function chooseDigger(state: GameState, selection: TeamSelection): Player {
  if (selection.liberoPlayerId) {
    return playerOrThrow(state, selection.liberoPlayerId);
  }

  return bestPlayer(rotationPlayers(state, selection), (player) =>
    effectiveAbility(player, "receive") * 1.6 +
    effectiveAbility(player, "speed") * 0.7 +
    effectiveAbility(player, "decision") * 0.45,
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

function createEventWriter(): EventWriter {
  const events: MatchEvent[] = [];

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

function serveStrength(server: Player, school: School): number {
  return (
    effectiveAbility(server, "serve") * 0.72 +
    effectiveAbility(server, "mental") * 0.18 +
    school.coach.tactics * 0.1 +
    school.tactics.serveRisk * 0.12
  );
}

function receiveStrength(receiver: Player, school: School): number {
  return (
    effectiveAbility(receiver, "receive") * 0.7 +
    effectiveAbility(receiver, "speed") * 0.18 +
    effectiveAbility(receiver, "decision") * 0.12 +
    school.coach.tactics * 0.07 +
    school.coach.leadership * 0.04
  );
}

function blockSystemBonus(school: School): number {
  switch (school.tactics.blockSystem) {
    case "commit":
      return 4;
    case "read":
      return 7;
    case "mixed":
      return 5.5;
  }
}

function defenseBiasBonus(school: School): number {
  return school.tactics.defenseBias === "balanced" ? 5 : 3;
}

function simulateRally(
  state: GameState,
  runtime: RallyRuntime,
  random: RandomSource,
  writer: EventWriter,
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
  );
  const serverStrength = serveStrength(server, serving.school);
  const receiverStrength = receiveStrength(receiver, receiving.school);
  const serveErrorChance = clamp(
    0.024 +
      serving.school.tactics.serveRisk * 0.00105 -
      serverStrength * 0.00024,
    0.012,
    0.17,
  );

  writer.push(
    "serve",
    runtime,
    server.id,
    receiver.id,
    null,
    "serve.in-play",
  );

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
      serving.school.tactics.serveRisk * 0.00065,
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
  const receiveQuality = receiverStrength + receiveVariation;
  writer.push(
    "receive",
    runtime,
    receiver.id,
    server.id,
    null,
    receiveQuality >= 72 ? "receive.perfect" : "receive.controlled",
  );

  const setter = chooseSetter(state, receiving.selection);
  const tempoModifier =
    receiving.school.tactics.attackTempo === "fast"
      ? 5
      : receiving.school.tactics.attackTempo === "slow"
        ? 2
        : 4;
  const setQuality =
    effectiveAbility(setter, "set") * 0.66 +
    effectiveAbility(setter, "decision") * 0.24 +
    receiveQuality * 0.28 +
    receiving.school.coach.tactics * 0.08 +
    tempoModifier +
    (random.next() - 0.5) * 12;
  const attacker = chooseAttacker(state, receiving, random);
  writer.push(
    "set",
    runtime,
    setter.id,
    attacker.id,
    null,
    setQuality >= 82 ? "set.ideal" : "set.available",
  );

  const attackPower =
    effectiveAbility(attacker, "spike") * 0.58 +
    effectiveAbility(attacker, "jump") * 0.19 +
    effectiveAbility(attacker, "decision") * 0.11 +
    attacker.positionAptitudes[attacker.preferredPosition] * 0.12 +
    setQuality * 0.35 +
    receiving.school.coach.tactics * 0.07 +
    (random.next() - 0.5) * 16;
  const blocker = chooseBlocker(state, serving.selection);
  const digger = chooseDigger(state, serving.selection);
  const blockPower =
    effectiveAbility(blocker, "block") * 0.62 +
    effectiveAbility(blocker, "jump") * 0.24 +
    effectiveAbility(blocker, "decision") * 0.14 +
    serving.school.coach.tactics * 0.08 +
    blockSystemBonus(serving.school);
  const digPower =
    effectiveAbility(digger, "receive") * 0.58 +
    effectiveAbility(digger, "speed") * 0.25 +
    effectiveAbility(digger, "decision") * 0.17 +
    serving.school.coach.leadership * 0.07 +
    defenseBiasBonus(serving.school);

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
    writer.push(
      "block",
      runtime,
      blocker.id,
      attacker.id,
      null,
      "block.kill",
    );
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

  writer.push(
    "block",
    runtime,
    blocker.id,
    attacker.id,
    null,
    "block.touch",
  );
  const defensivePower = blockPower * 0.42 + digPower * 0.58;
  const attackPointChance = clamp(
    0.5 + (attackPower - defensivePower) * 0.0032,
    0.16,
    0.84,
  );

  if (random.next() < attackPointChance) {
    writer.push(
      "dig",
      runtime,
      digger.id,
      attacker.id,
      null,
      "dig.failed",
    );
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

  writer.push(
    "dig",
    runtime,
    digger.id,
    attacker.id,
    null,
    "dig.counter",
  );
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
  const opponentServeErrors = points.filter(
    (event) => event.detailCode === "point.serve-error",
  ).length;
  const ownServeErrors = match.eventLog.filter(
    (event) =>
      event.type === "point" &&
      event.detailCode === "point.serve-error" &&
      event.winnerSchoolId !== schoolId,
  ).length;

  return {
    totalPoints: points.length,
    aces: points.filter((event) => event.detailCode === "point.serve-ace").length,
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
        activePlayers(state, selection).map((player) => readiness(player) * 100),
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

function createMatchAnalysis(state: GameState, match: MatchState): MatchAnalysis {
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
  const winner = matchMetrics(
    state,
    match,
    winnerSchoolId,
    winnerSelection,
  );
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

export function simulateMatch(input: SimulateMatchInput): SimulateMatchResult {
  validateMatchInput(input);

  const initialRandom = input.random.snapshot();
  const homeSchool = input.state.schools[input.homeSchoolId]!;
  const awaySchool = input.state.schools[input.awaySchoolId]!;
  const writer = createEventWriter();
  const sets: MatchSetState[] = [];
  const requiredSetWins = Math.ceil(input.bestOfSets / 2);
  let homeSetsWon = 0;
  let awaySetsWon = 0;
  let finalHomeSelection = cloneSelection(input.homeSelection);
  let finalAwaySelection = cloneSelection(input.awaySelection);
  let finalServingSide: MatchSide = "home";

  for (
    let setNumber = 1;
    homeSetsWon < requiredSetWins && awaySetsWon < requiredSetWins;
    setNumber += 1
  ) {
    const homeSelection = cloneSelection(input.homeSelection);
    const awaySelection = cloneSelection(input.awaySelection);
    const runtime: RallyRuntime = {
      setNumber,
      homeScore: 0,
      awayScore: 0,
      servingSide: setNumber % 2 === 1 ? "home" : "away",
      home: { side: "home", school: homeSchool, selection: homeSelection },
      away: { side: "away", school: awaySchool, selection: awaySelection },
    };
    let rallies = 0;

    while (
      !setIsComplete(
        setNumber,
        input.bestOfSets,
        runtime.homeScore,
        runtime.awayScore,
      )
    ) {
      rallies += 1;
      if (rallies > MAX_RALLIES_PER_SET) {
        throw new Error("match set exceeded rally safety limit");
      }

      const servingBeforeRally = runtime.servingSide;
      const winner = simulateRally(input.state, runtime, input.random, writer);
      if (winner !== servingBeforeRally) {
        const winnerRuntime = runtimeForSide(runtime, winner);
        rotateSelection(winnerRuntime.selection);
        writer.push(
          "rotation",
          runtime,
          winnerRuntime.selection.servingOrderPlayerIds[0] ?? null,
          null,
          winnerRuntime.school.id,
          "rotation.side-out",
        );
        runtime.servingSide = winner;
      }
    }

    const winnerSide: MatchSide =
      runtime.homeScore > runtime.awayScore ? "home" : "away";
    const winnerSchoolId = schoolIdForSide(runtime, winnerSide);
    if (winnerSide === "home") {
      homeSetsWon += 1;
    } else {
      awaySetsWon += 1;
    }

    sets.push({
      setNumber,
      homeScore: runtime.homeScore,
      awayScore: runtime.awayScore,
      completed: true,
      winnerSchoolId,
    });
    writer.push(
      "set-end",
      runtime,
      null,
      null,
      winnerSchoolId,
      "set.complete",
    );
    finalHomeSelection = runtime.home.selection;
    finalAwaySelection = runtime.away.selection;
    finalServingSide = runtime.servingSide;
  }

  const winnerSchoolId =
    homeSetsWon > awaySetsWon ? input.homeSchoolId : input.awaySchoolId;
  const finalSet = sets.at(-1)!;
  const finalRuntime: RallyRuntime = {
    setNumber: finalSet.setNumber,
    homeScore: finalSet.homeScore,
    awayScore: finalSet.awayScore,
    servingSide: finalServingSide,
    home: {
      side: "home",
      school: homeSchool,
      selection: finalHomeSelection,
    },
    away: {
      side: "away",
      school: awaySchool,
      selection: finalAwaySelection,
    },
  };
  writer.push(
    "match-end",
    finalRuntime,
    null,
    null,
    winnerSchoolId,
    "match.complete",
  );

  const match: MatchState = {
    id: input.id,
    homeSchoolId: input.homeSchoolId,
    awaySchoolId: input.awaySchoolId,
    homeSelection: finalHomeSelection,
    awaySelection: finalAwaySelection,
    bestOfSets: input.bestOfSets,
    phase: "match-complete",
    currentSetNumber: finalSet.setNumber,
    homeSetsWon,
    awaySetsWon,
    sets,
    servingSchoolId:
      finalServingSide === "home" ? input.homeSchoolId : input.awaySchoolId,
    pendingCoachCommandForSchoolId: null,
    eventLog: writer.events,
    randomSeed: initialRandom.seed,
    randomCursor: input.random.cursor,
  };

  return {
    match,
    analysis: createMatchAnalysis(input.state, match),
  };
}
