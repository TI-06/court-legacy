import type { GameState } from "../../domain/model/GameState";
import type { MatchEvent, MatchState } from "../../domain/model/Match";
import type { PlayerId, SchoolId } from "../../domain/model/identifiers";

export interface MatchPresentationContext {
  state: GameState;
  match: MatchState;
}

export interface PresentedMatchEvent {
  sequence: number;
  title: string;
  detail: string;
  tone: "neutral" | "home" | "away" | "important";
  score: string;
}

function playerName(state: GameState, playerId: PlayerId | null): string {
  if (!playerId) {
    return "選手";
  }
  const player = state.players[playerId];
  return player ? `${player.lastName} ${player.firstName}` : "選手";
}

function schoolName(state: GameState, schoolId: SchoolId | null): string {
  if (!schoolId) {
    return "チーム";
  }
  return state.schools[schoolId]?.name ?? "チーム";
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
  const winner = schoolName(context.state, event.winnerSchoolId);

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
