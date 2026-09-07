import type { GameState } from "../../domain/model/GameState";
import type { MatchEvent, MatchState } from "../../domain/model/Match";
import type { Player, Position } from "../../domain/model/Player";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import type {
  PlayerId,
  SchoolId,
} from "../../domain/model/identifiers";

export interface MatchPresentationContext {
  state: GameState;
  match: MatchState;
  schoolDisplayNames?: Partial<Record<SchoolId, string>>;
}

export interface PresentedMatchEvent {
  sequence: number;
  title: string;
  detail: string;
  tone: "neutral" | "home" | "away" | "important";
  score: string;
}

export interface TeamProfile {
  attack: number;
  block: number;
  serve: number;
  receive: number;
  teamwork: number;
  stamina: number;
}

export interface TeamMatchStats {
  schoolId: SchoolId;
  attackPoints: number;
  blockPoints: number;
  serviceAces: number;
  defensePoints: number;
  serveErrors: number;
  attackAttempts: number;
  receiveAttempts: number;
  perfectReceives: number;
  attackSuccessRate: number;
  perfectReceiveRate: number;
}

export interface PlayerMatchStats {
  playerId: PlayerId;
  schoolId: SchoolId;
  name: string;
  position: Position;
  points: number;
  attackPoints: number;
  blockPoints: number;
  serviceAces: number;
  defensePoints: number;
  attackAttempts: number;
  receiveAttempts: number;
  perfectReceives: number;
  attackSuccessRate: number;
  perfectReceiveRate: number;
}

export interface MatchStatSummary {
  home: TeamMatchStats;
  away: TeamMatchStats;
  players: PlayerMatchStats[];
  mvp: PlayerMatchStats;
  topScorer: PlayerMatchStats;
  topBlocker: PlayerMatchStats;
  topServer: PlayerMatchStats;
  bestReceiver: PlayerMatchStats;
}

function playerName(state: GameState, playerId: PlayerId | null): string {
  if (!playerId) {
    return "選手";
  }
  const player = state.players[playerId];
  return player ? `${player.lastName} ${player.firstName}` : "選手";
}

function schoolName(
  context: MatchPresentationContext,
  schoolId: SchoolId | null,
): string {
  if (!schoolId) return "チーム";
  return (
    context.schoolDisplayNames?.[schoolId] ??
    context.state.schools[schoolId]?.name ??
    "チーム"
  );
}

function eventTone(
  event: MatchEvent,
  match: MatchState,
): PresentedMatchEvent["tone"] {
  if (
    event.type === "set-end" ||
    event.type === "match-end" ||
    event.type === "injury"
  ) {
    return "important";
  }
  if (event.winnerSchoolId === match.homeSchoolId) {
    return "home";
  }
  if (event.winnerSchoolId === match.awaySchoolId) {
    return "away";
  }
  return "neutral";
}

function titleFor(event: MatchEvent): string {
  switch (event.type) {
    case "serve":
      return event.detailCode === "serve.ace"
        ? "サービスエース"
        : event.detailCode === "serve.error"
          ? "サーブミス"
          : "サーブ";
    case "receive":
      return "レシーブ";
    case "set":
      return "トス";
    case "attack":
      return "アタック";
    case "block":
      return event.detailCode === "block.kill"
        ? "ブロックポイント"
        : "ブロックタッチ";
    case "dig":
      return event.detailCode === "dig.counter" ? "好レシーブ" : "守備";
    case "point":
      if (event.detailCode === "point.attack") {
        return "アタック決定";
      }
      if (event.detailCode === "point.block") {
        return "ブロック決定";
      }
      if (event.detailCode === "point.serve-ace") {
        return "サービスエース";
      }
      if (event.detailCode === "point.serve-error") {
        return "サーブミス";
      }
      return "得点";
    case "rotation":
      return "ローテーション";
    case "substitution":
      return "選手交代";
    case "timeout":
      return "タイムアウト";
    case "injury":
      return "アクシデント";
    case "set-end":
      return `第${event.setNumber}セット終了`;
    case "match-end":
      return "試合終了";
  }
}

function detailFor(
  event: MatchEvent,
  context: MatchPresentationContext,
): string {
  const actor = playerName(context.state, event.actorPlayerId);
  const target = playerName(context.state, event.targetPlayerId);
  const winner = schoolName(context, event.winnerSchoolId);

  switch (event.type) {
    case "serve":
      if (event.detailCode === "serve.ace") {
        return `${actor}の鋭いサーブがそのまま決まりました。`;
      }
      if (event.detailCode === "serve.error") {
        return `${actor}のサーブはコートを外れました。`;
      }
      return `${actor}が${target}を狙ってサーブを放ちます。`;
    case "receive":
      return event.detailCode === "receive.perfect"
        ? `${actor}が正確にサーブを返しました。`
        : `${actor}が崩されながらもボールをつなぎます。`;
    case "set":
      return event.detailCode === "set.ideal"
        ? `${actor}が${target}へ理想的なトスを供給します。`
        : `${actor}が${target}へ攻撃可能なトスを上げます。`;
    case "attack":
      return `${actor}が${target}のブロックへアタックします。`;
    case "block":
      return event.detailCode === "block.kill"
        ? `${actor}が${target}の攻撃を完全に止めました。`
        : `${actor}がワンタッチを取り、守備へつなぎます。`;
    case "dig":
      return event.detailCode === "dig.counter"
        ? `${actor}が${target}の強打を拾い、切り返します。`
        : `${actor}は${target}の攻撃に届きませんでした。`;
    case "point":
      if (event.detailCode === "point.serve-error") {
        return `${winner}が相手のサーブミスで得点しました。`;
      }
      return `${actor}のプレーで${winner}が得点しました。`;
    case "rotation":
      return `${winner}がサイドアウトを取り、${actor}が次のサーブ位置へ回ります。`;
    case "substitution":
      return `${actor}と${target}を交代します。`;
    case "timeout":
      return `${winner}がタイムアウトを取ります。`;
    case "injury":
      return `${actor}にアクシデントが発生しました。`;
    case "set-end":
      return `${winner}が第${event.setNumber}セットを${event.homeScore}-${event.awayScore}で獲得しました。`;
    case "match-end":
      return `${winner}がセットカウント ${context.match.homeSetsWon}-${context.match.awaySetsWon} で勝利しました。`;
  }
}

function clampRating(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function selectionPlayers(
  state: GameState,
  selection: TeamSelection,
  includeLibero: boolean,
): Player[] {
  const ids = selection.rotation.map((assignment) => assignment.playerId);
  if (includeLibero && selection.liberoPlayerId) {
    ids.push(selection.liberoPlayerId);
  }
  return [...new Set(ids)]
    .map((id) => state.players[id])
    .filter((player): player is Player => Boolean(player));
}

function averageRating(
  players: readonly Player[],
  score: (player: Player) => number,
): number {
  if (players.length === 0) {
    return 0;
  }
  return clampRating(
    players.reduce((sum, player) => sum + score(player), 0) / players.length,
  );
}

export function buildTeamProfile(
  state: GameState,
  selection: TeamSelection,
): TeamProfile {
  const rotation = selectionPlayers(state, selection, false);
  const active = selectionPlayers(state, selection, true);

  return {
    attack: averageRating(
      rotation,
      (player) =>
        player.abilities.spike * 0.55 +
        player.abilities.jump * 0.25 +
        player.abilities.decision * 0.2,
    ),
    block: averageRating(
      rotation,
      (player) =>
        player.abilities.block * 0.55 +
        player.abilities.jump * 0.25 +
        player.abilities.decision * 0.2,
    ),
    serve: averageRating(
      rotation,
      (player) =>
        player.abilities.serve * 0.65 +
        player.abilities.mental * 0.2 +
        player.abilities.decision * 0.15,
    ),
    receive: averageRating(
      active,
      (player) =>
        player.abilities.receive * 0.6 +
        player.abilities.speed * 0.25 +
        player.abilities.decision * 0.15,
    ),
    teamwork: averageRating(
      active,
      (player) =>
        player.trust * 0.35 +
        player.morale * 0.25 +
        (player.teamAdaptation ?? 50) * 0.25 +
        player.abilities.mental * 0.15,
    ),
    stamina: averageRating(
      rotation,
      (player) => player.abilities.stamina * 0.7 + player.condition * 0.3,
    ),
  };
}

function createTeamStats(schoolId: SchoolId): TeamMatchStats {
  return {
    schoolId,
    attackPoints: 0,
    blockPoints: 0,
    serviceAces: 0,
    defensePoints: 0,
    serveErrors: 0,
    attackAttempts: 0,
    receiveAttempts: 0,
    perfectReceives: 0,
    attackSuccessRate: 0,
    perfectReceiveRate: 0,
  };
}

function activeSelectionIds(selection: TeamSelection): PlayerId[] {
  const ids = selection.rotation.map((assignment) => assignment.playerId);
  if (selection.liberoPlayerId) {
    ids.push(selection.liberoPlayerId);
  }
  return [...new Set(ids)];
}

function createPlayerStats(
  player: Player,
  schoolId: SchoolId,
): PlayerMatchStats {
  return {
    playerId: player.id,
    schoolId,
    name: `${player.lastName} ${player.firstName}`,
    position: player.preferredPosition,
    points: 0,
    attackPoints: 0,
    blockPoints: 0,
    serviceAces: 0,
    defensePoints: 0,
    attackAttempts: 0,
    receiveAttempts: 0,
    perfectReceives: 0,
    attackSuccessRate: 0,
    perfectReceiveRate: 0,
  };
}

function percentage(numerator: number, denominator: number): number {
  return denominator <= 0 ? 0 : Math.round((numerator / denominator) * 100);
}

function bestPlayerBy(
  players: readonly PlayerMatchStats[],
  score: (player: PlayerMatchStats) => number,
): PlayerMatchStats {
  const player = [...players].sort((first, second) => {
    const scoreDifference = score(second) - score(first);
    if (scoreDifference !== 0) return scoreDifference;
    if (second.points !== first.points) return second.points - first.points;
    return first.playerId.localeCompare(second.playerId);
  })[0];
  if (!player) {
    throw new Error("completed match has no player statistics");
  }
  return player;
}

export function buildMatchStatSummary(
  state: GameState,
  match: MatchState,
): MatchStatSummary {
  const home = createTeamStats(match.homeSchoolId);
  const away = createTeamStats(match.awaySchoolId);
  const schoolByPlayerId = new Map<PlayerId, SchoolId>();
  const playerStats = new Map<PlayerId, PlayerMatchStats>();

  for (const playerId of activeSelectionIds(match.homeSelection)) {
    schoolByPlayerId.set(playerId, match.homeSchoolId);
    const player = state.players[playerId];
    if (player) {
      playerStats.set(playerId, createPlayerStats(player, match.homeSchoolId));
    }
  }
  for (const playerId of activeSelectionIds(match.awaySelection)) {
    schoolByPlayerId.set(playerId, match.awaySchoolId);
    const player = state.players[playerId];
    if (player) {
      playerStats.set(playerId, createPlayerStats(player, match.awaySchoolId));
    }
  }

  const teamForSchool = (schoolId: SchoolId): TeamMatchStats =>
    schoolId === match.homeSchoolId ? home : away;
  const statsForActor = (
    playerId: PlayerId | null,
  ): PlayerMatchStats | undefined => {
    if (!playerId) return undefined;
    const existing = playerStats.get(playerId);
    if (existing) return existing;
    const player = state.players[playerId];
    const schoolId = schoolByPlayerId.get(playerId) ?? player?.career.schoolId;
    if (!player || !schoolId) return undefined;
    const created = createPlayerStats(player, schoolId);
    playerStats.set(playerId, created);
    schoolByPlayerId.set(playerId, schoolId);
    return created;
  };

  for (const matchEvent of match.eventLog) {
    const actor = statsForActor(matchEvent.actorPlayerId);
    const actorSchoolId = actor?.schoolId;
    const actorTeam = actorSchoolId ? teamForSchool(actorSchoolId) : undefined;

    if (matchEvent.type === "attack" && actor && actorTeam) {
      actor.attackAttempts += 1;
      actorTeam.attackAttempts += 1;
    }

    if (matchEvent.type === "receive" && actor && actorTeam) {
      actor.receiveAttempts += 1;
      actorTeam.receiveAttempts += 1;
      if (matchEvent.detailCode === "receive.perfect") {
        actor.perfectReceives += 1;
        actorTeam.perfectReceives += 1;
      }
    }

    if (
      matchEvent.type === "serve" &&
      matchEvent.detailCode === "serve.error" &&
      actorTeam
    ) {
      actorTeam.serveErrors += 1;
    }

    if (matchEvent.type !== "point" || !actor || !actorTeam) {
      continue;
    }

    switch (matchEvent.detailCode) {
      case "point.attack":
        actor.points += 1;
        actor.attackPoints += 1;
        actorTeam.attackPoints += 1;
        break;
      case "point.block":
        actor.points += 1;
        actor.blockPoints += 1;
        actorTeam.blockPoints += 1;
        break;
      case "point.serve-ace":
        actor.points += 1;
        actor.serviceAces += 1;
        actorTeam.serviceAces += 1;
        break;
      case "point.defense":
        actor.points += 1;
        actor.defensePoints += 1;
        actorTeam.defensePoints += 1;
        break;
      default:
        break;
    }
  }

  home.attackSuccessRate = percentage(home.attackPoints, home.attackAttempts);
  away.attackSuccessRate = percentage(away.attackPoints, away.attackAttempts);
  home.perfectReceiveRate = percentage(
    home.perfectReceives,
    home.receiveAttempts,
  );
  away.perfectReceiveRate = percentage(
    away.perfectReceives,
    away.receiveAttempts,
  );

  const players = [...playerStats.values()].map((stats) => ({
    ...stats,
    attackSuccessRate: percentage(stats.attackPoints, stats.attackAttempts),
    perfectReceiveRate: percentage(
      stats.perfectReceives,
      stats.receiveAttempts,
    ),
  }));
  const winnerSchoolId =
    match.homeSetsWon > match.awaySetsWon
      ? match.homeSchoolId
      : match.awaySchoolId;
  const winningPlayers = players.filter(
    (player) => player.schoolId === winnerSchoolId,
  );
  const mvpPool = winningPlayers.length > 0 ? winningPlayers : players;

  return {
    home,
    away,
    players,
    mvp: bestPlayerBy(
      mvpPool,
      (player) =>
        player.points * 6 +
        player.blockPoints * 2 +
        player.serviceAces * 2 +
        player.defensePoints +
        player.perfectReceives * 0.75 +
        player.attackSuccessRate * 0.03 +
        player.perfectReceiveRate * 0.02,
    ),
    topScorer: bestPlayerBy(players, (player) => player.points),
    topBlocker: bestPlayerBy(players, (player) => player.blockPoints),
    topServer: bestPlayerBy(players, (player) => player.serviceAces),
    bestReceiver: bestPlayerBy(players, (player) =>
      player.receiveAttempts > 0
        ? player.perfectReceiveRate * 10 + player.receiveAttempts
        : -1,
    ),
  };
}

export function presentMatchEvent(
  event: MatchEvent,
  context: MatchPresentationContext,
): PresentedMatchEvent {
  return {
    sequence: event.sequence,
    title: titleFor(event),
    detail: detailFor(event, context),
    tone: eventTone(event, context.match),
    score: `${event.homeScore} - ${event.awayScore}`,
  };
}

export function summarizeSetScore(match: MatchState): string {
  const sets = match.sets
    .map((set) => `${set.homeScore}-${set.awayScore}`)
    .join(" / ");
  return `${match.homeSetsWon} - ${match.awaySetsWon}｜${sets}`;
}
