import type {
  GameState,
  HistoricalMatchSummary,
} from "../model/GameState";
import type {
  GameDate,
  MatchId,
  SchoolId,
} from "../model/identifiers";
import { rivalryKey } from "./rivalWorldProgression";

const RIVALRY_PRESENTATION_THRESHOLD = 40;
const NEMESIS_MIN_MEETINGS = 4;
const NEMESIS_MAX_WIN_RATE = 0.25;
const VISIBLE_STREAK_MIN = 2;

export type UserMatchResult = "win" | "loss";

export type RivalryLabel =
  | "destiny-rival"
  | "rivalry"
  | "nemesis"
  | "revenge"
  | "winning-streak"
  | "losing-streak";

export interface HeadToHeadMeeting {
  matchId: MatchId;
  date: GameDate;
  result: UserMatchResult;
  userSetsWon: number;
  opponentSetsWon: number;
  official: boolean;
}

export interface HeadToHeadSummary {
  opponentSchoolId: SchoolId;
  totalMeetings: number;
  wins: number;
  losses: number;
  officialMeetings: number;
  practiceMeetings: number;
  currentStreak: { result: UserMatchResult; count: number } | null;
  lastMeeting: HeadToHeadMeeting | null;
  lastFive: HeadToHeadMeeting[];
  rivalryScore: number;
  destinyRival: boolean;
  labels: RivalryLabel[];
}

export type NotableMatchReason =
  | "official"
  | "close"
  | "rival"
  | "destiny-rival"
  | "rematch";

export interface NotableUserMatch {
  match: HistoricalMatchSummary;
  score: number;
  reasons: NotableMatchReason[];
}

interface UserMeetingWithOpponent extends HeadToHeadMeeting {
  opponentSchoolId: SchoolId;
  summary: HistoricalMatchSummary;
}

function compareChronological(
  left: Pick<HistoricalMatchSummary, "date" | "matchId">,
  right: Pick<HistoricalMatchSummary, "date" | "matchId">,
): number {
  return (
    left.date.localeCompare(right.date) ||
    String(left.matchId).localeCompare(String(right.matchId))
  );
}

function toUserMeeting(
  state: GameState,
  summary: HistoricalMatchSummary,
): UserMeetingWithOpponent | null {
  const userIsHome = summary.homeSchoolId === state.userSchoolId;
  const userIsAway = summary.awaySchoolId === state.userSchoolId;
  if (userIsHome === userIsAway) {
    return null;
  }

  const opponentSchoolId = userIsHome
    ? summary.awaySchoolId
    : summary.homeSchoolId;
  const userSetsWon = userIsHome
    ? summary.homeSetsWon
    : summary.awaySetsWon;
  const opponentSetsWon = userIsHome
    ? summary.awaySetsWon
    : summary.homeSetsWon;

  return {
    opponentSchoolId,
    summary,
    matchId: summary.matchId,
    date: summary.date,
    result:
      summary.winnerSchoolId === state.userSchoolId ? "win" : "loss",
    userSetsWon,
    opponentSetsWon,
    official: summary.tournamentId !== null,
  };
}

function orderedUserMeetings(state: GameState): UserMeetingWithOpponent[] {
  return state.history.matches
    .map((summary) => toUserMeeting(state, summary))
    .filter((meeting): meeting is UserMeetingWithOpponent => meeting !== null)
    .sort((left, right) => compareChronological(left.summary, right.summary));
}

function currentStreak(
  meetings: readonly HeadToHeadMeeting[],
): HeadToHeadSummary["currentStreak"] {
  const latest = meetings.at(-1);
  if (!latest) return null;

  let count = 0;
  for (let index = meetings.length - 1; index >= 0; index -= 1) {
    if (meetings[index]?.result !== latest.result) break;
    count += 1;
  }

  return { result: latest.result, count };
}

function labelsForSummary(
  summary: Omit<HeadToHeadSummary, "labels">,
): RivalryLabel[] {
  const labels: RivalryLabel[] = [];

  if (summary.destinyRival) {
    labels.push("destiny-rival");
  } else if (summary.rivalryScore >= RIVALRY_PRESENTATION_THRESHOLD) {
    labels.push("rivalry");
  }

  const winRate =
    summary.totalMeetings === 0 ? 0 : summary.wins / summary.totalMeetings;
  if (
    summary.totalMeetings >= NEMESIS_MIN_MEETINGS &&
    winRate <= NEMESIS_MAX_WIN_RATE &&
    summary.currentStreak?.result === "loss" &&
    summary.currentStreak.count >= VISIBLE_STREAK_MIN
  ) {
    labels.push("nemesis");
  }

  if (summary.lastMeeting?.result === "loss") {
    labels.push("revenge");
  }

  if (
    summary.currentStreak &&
    summary.currentStreak.count >= VISIBLE_STREAK_MIN
  ) {
    labels.push(
      summary.currentStreak.result === "win"
        ? "winning-streak"
        : "losing-streak",
    );
  }

  return labels;
}

export function selectUserHeadToHead(
  state: GameState,
  opponentSchoolId: SchoolId,
): HeadToHeadSummary {
  const meetings = orderedUserMeetings(state).filter(
    (meeting) => meeting.opponentSchoolId === opponentSchoolId,
  );
  const wins = meetings.filter((meeting) => meeting.result === "win").length;
  const officialMeetings = meetings.filter((meeting) => meeting.official).length;
  const streak = currentStreak(meetings);
  const last = meetings.at(-1) ?? null;
  const rivalryScore =
    state.world.rivalryScores[
      rivalryKey(state.userSchoolId, opponentSchoolId)
    ] ?? 0;
  const destinyRival = state.world.destinyRivalSchoolId === opponentSchoolId;
  const base: Omit<HeadToHeadSummary, "labels"> = {
    opponentSchoolId,
    totalMeetings: meetings.length,
    wins,
    losses: meetings.length - wins,
    officialMeetings,
    practiceMeetings: meetings.length - officialMeetings,
    currentStreak: streak,
    lastMeeting: last
      ? {
          matchId: last.matchId,
          date: last.date,
          result: last.result,
          userSetsWon: last.userSetsWon,
          opponentSetsWon: last.opponentSetsWon,
          official: last.official,
        }
      : null,
    lastFive: meetings
      .slice(-5)
      .reverse()
      .map((meeting) => ({
        matchId: meeting.matchId,
        date: meeting.date,
        result: meeting.result,
        userSetsWon: meeting.userSetsWon,
        opponentSetsWon: meeting.opponentSetsWon,
        official: meeting.official,
      })),
    rivalryScore,
    destinyRival,
  };

  return { ...base, labels: labelsForSummary(base) };
}

export function selectUserHeadToHeadTable(
  state: GameState,
): HeadToHeadSummary[] {
  const opponentIds = new Set<SchoolId>();
  for (const meeting of orderedUserMeetings(state)) {
    opponentIds.add(meeting.opponentSchoolId);
  }

  return [...opponentIds]
    .map((opponentSchoolId) =>
      selectUserHeadToHead(state, opponentSchoolId),
    )
    .sort(
      (left, right) =>
        Number(right.destinyRival) - Number(left.destinyRival) ||
        right.rivalryScore - left.rivalryScore ||
        right.totalMeetings - left.totalMeetings ||
        String(left.opponentSchoolId).localeCompare(
          String(right.opponentSchoolId),
        ),
    );
}

function notableMatchReasons(
  state: GameState,
  meeting: UserMeetingWithOpponent,
  priorMeetingCount: number,
): { score: number; reasons: NotableMatchReason[] } {
  const reasons: NotableMatchReason[] = [];
  let score = 0;

  if (meeting.official) {
    reasons.push("official");
    score += 20;
  }
  if (Math.abs(meeting.userSetsWon - meeting.opponentSetsWon) <= 1) {
    reasons.push("close");
    score += 10;
  }

  const rivalryScore =
    state.world.rivalryScores[
      rivalryKey(state.userSchoolId, meeting.opponentSchoolId)
    ] ?? 0;
  if (state.world.destinyRivalSchoolId === meeting.opponentSchoolId) {
    reasons.push("destiny-rival");
    score += 12;
  } else if (rivalryScore >= RIVALRY_PRESENTATION_THRESHOLD) {
    reasons.push("rival");
    score += 8;
  }

  if (priorMeetingCount > 0) {
    reasons.push("rematch");
    score += Math.min(8, priorMeetingCount * 2);
  }

  return { score, reasons };
}

export function selectNotableUserMatches(
  state: GameState,
  limit = 5,
): NotableUserMatch[] {
  if (limit <= 0) return [];

  const meetingCounts = new Map<SchoolId, number>();
  const notable = orderedUserMeetings(state).map((meeting) => {
    const priorMeetingCount = meetingCounts.get(meeting.opponentSchoolId) ?? 0;
    meetingCounts.set(meeting.opponentSchoolId, priorMeetingCount + 1);
    const assessment = notableMatchReasons(state, meeting, priorMeetingCount);
    return {
      match: meeting.summary,
      ...assessment,
    } satisfies NotableUserMatch;
  });

  return notable
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.match.date.localeCompare(left.match.date) ||
        String(left.match.matchId).localeCompare(String(right.match.matchId)),
    )
    .slice(0, limit);
}
