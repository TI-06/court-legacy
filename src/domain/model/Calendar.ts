import type { GameDate, MatchId, PlayerId } from "./identifiers";

export type ActivityType =
  | "practice"
  | "exam"
  | "camp"
  | "practice-match"
  | "qualifier"
  | "prefectural-tournament"
  | "national-tournament"
  | "graduation"
  | "intake"
  | "recovery";

export interface ScheduledActivity {
  id: string;
  date: GameDate;
  type: ActivityType;
  title: string;
  mandatory: boolean;
  matchId: MatchId | null;
  metadata: Record<string, string | number | boolean>;
}

export interface CalendarState {
  currentDate: GameDate;
  academicYear: number;
  weekOfYear: number;
  monthPolicyId: string | null;
  activities: ScheduledActivity[];
  completedActivityIds: string[];
}

export interface MonthlyReport {
  academicYear: number;
  month: number;
  wins: number;
  losses: number;
  averageFatigue: number;
  reputationChange: number;
  highlightedPlayerIds: PlayerId[];
  issueIds: string[];
}
