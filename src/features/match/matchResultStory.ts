import type { GameState } from "../../domain/model/GameState";
import type { MatchState } from "../../domain/model/Match";
import type { SchoolId } from "../../domain/model/identifiers";
import { selectUserHeadToHead } from "../../domain/world/rivalryHistory";
import { buildMatchStatSummary } from "./matchPresentation";

export interface MatchResultStoryPresentation {
  headline: string;
  recordLabel: string;
  chips: string[];
  facts: string[];
}

function opponentSchoolId(
  state: GameState,
  match: MatchState,
): SchoolId | null {
  if (match.homeSchoolId === state.userSchoolId) {
    return match.awaySchoolId;
  }
  if (match.awaySchoolId === state.userSchoolId) {
    return match.homeSchoolId;
  }
  return null;
}

function priorStateWithoutCurrentMatch(
  state: GameState,
  match: MatchState,
): GameState {
  return {
    ...state,
    history: {
      ...state.history,
      matches: state.history.matches.filter(
        (summary) => summary.matchId !== match.id,
      ),
    },
  };
}

function resultForUser(
  state: GameState,
  match: MatchState,
): {
  won: boolean;
  userSetsWon: number;
  opponentSetsWon: number;
} {
  const userIsHome = match.homeSchoolId === state.userSchoolId;
  const userSetsWon = userIsHome ? match.homeSetsWon : match.awaySetsWon;
  const opponentSetsWon = userIsHome ? match.awaySetsWon : match.homeSetsWon;
  return {
    won: userSetsWon > opponentSetsWon,
    userSetsWon,
    opponentSetsWon,
  };
}

function postMatchStreak(
  previous: ReturnType<typeof selectUserHeadToHead>["currentStreak"],
  won: boolean,
): { result: "win" | "loss"; count: number } {
  const result = won ? "win" : "loss";
  return {
    result,
    count: previous?.result === result ? previous.count + 1 : 1,
  };
}

function setFlowChip(
  match: MatchState,
  userSetsWon: number,
  opponentSetsWon: number,
): string | null {
  const completedSets = match.sets.filter((set) => set.completed).length;
  if (
    completedSets === match.bestOfSets &&
    userSetsWon > 0 &&
    opponentSetsWon > 0
  ) {
    return "フルセット";
  }
  if (opponentSetsWon === 0) return "ストレート勝ち";
  if (userSetsWon === 0) return "ストレート敗戦";
  return null;
}

function statSpotlight(state: GameState, match: MatchState): string {
  const summary = buildMatchStatSummary(state, match);
  const userIsHome = match.homeSchoolId === state.userSchoolId;
  const user = userIsHome ? summary.home : summary.away;
  const opponent = userIsHome ? summary.away : summary.home;

  const candidates = [
    {
      margin: Math.abs(user.blockPoints - opponent.blockPoints),
      label: `ブロック得点 ${user.blockPoints}-${opponent.blockPoints}`,
    },
    {
      margin: Math.abs(user.serviceAces - opponent.serviceAces),
      label: `サーブエース ${user.serviceAces}-${opponent.serviceAces}`,
    },
    {
      margin: Math.abs(user.attackSuccessRate - opponent.attackSuccessRate),
      label: `アタック決定率 ${user.attackSuccessRate}%-${opponent.attackSuccessRate}%`,
    },
  ].sort((left, right) => right.margin - left.margin);

  return (
    candidates[0]?.label ?? `総得点 ${user.totalPoints}-${opponent.totalPoints}`
  );
}

export function buildMatchResultStory(
  state: GameState,
  match: MatchState,
): MatchResultStoryPresentation | null {
  const opponentId = opponentSchoolId(state, match);
  if (!opponentId || !state.schools[opponentId]) return null;

  const opponent = state.schools[opponentId]!;
  const priorState = priorStateWithoutCurrentMatch(state, match);
  const prior = selectUserHeadToHead(priorState, opponentId);
  const result = resultForUser(state, match);
  const postWins = prior.wins + (result.won ? 1 : 0);
  const postLosses = prior.losses + (result.won ? 0 : 1);
  const streak = postMatchStreak(prior.currentStreak, result.won);
  const priorWasNemesis = prior.labels.includes("nemesis");
  const destinyRival =
    prior.destinyRival || state.world.destinyRivalSchoolId === opponentId;
  const rivalry =
    destinyRival ||
    prior.labels.includes("rivalry") ||
    selectUserHeadToHead(state, opponentId).labels.includes("rivalry");
  const revengeAchieved = result.won && prior.lastMeeting?.result === "loss";

  let headline = result.won
    ? `${opponent.shortName}戦に勝利`
    : `${opponent.shortName}戦で敗戦`;

  if (destinyRival) {
    headline = result.won
      ? `宿敵・${opponent.shortName}との一戦を制す`
      : `宿敵・${opponent.shortName}との一戦で敗戦`;
  } else if (priorWasNemesis && result.won) {
    headline = `天敵・${opponent.shortName}を撃破`;
  } else if (revengeAchieved) {
    headline = `${opponent.shortName}に雪辱達成`;
  } else if (result.won && streak.count >= 2) {
    headline = `${opponent.shortName}戦 ${streak.count}連勝`;
  }

  const chips: string[] = [];
  if (destinyRival) chips.push("宿敵");
  else if (rivalry) chips.push("因縁");
  if (priorWasNemesis && result.won) chips.push("天敵撃破");
  if (revengeAchieved) chips.push("雪辱達成");
  if (streak.count >= 2) {
    chips.push(
      streak.result === "win" ? `${streak.count}連勝` : `${streak.count}連敗`,
    );
  }
  if (prior.totalMeetings === 0) chips.push("初対戦");
  const flow = setFlowChip(match, result.userSetsWon, result.opponentSetsWon);
  if (flow) chips.push(flow);

  const summary = buildMatchStatSummary(state, match);
  return {
    headline,
    recordLabel: `通算 ${postWins}勝${postLosses}敗`,
    chips: [...new Set(chips)].slice(0, 4),
    facts: [
      `セット ${result.userSetsWon}-${result.opponentSetsWon}`,
      `MVP ${summary.mvp.name}・${summary.mvp.points}得点`,
      statSpotlight(state, match),
    ],
  };
}
