import { createInitialGame } from "../../app/createInitialGame";
import type { AdvanceWeekOutcome } from "../../domain/calendar/advanceWeekOutcome";
import type { PlayerId } from "../../domain/model/identifiers";
import { autoSelectTeam } from "../../domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import type { GameAction } from "../../../worker/game/actionSchema";
import { applyGameAction } from "../../../worker/game/applyGameAction";
import {
  assertSoakInvariants,
  type SoakInvariantViolation,
} from "./soakInvariants";
import {
  captureSoakSnapshotMetrics,
  summarizeFacilityMilestones,
  type SoakFacilityMilestoneSummary,
  type SoakSnapshotMetrics,
} from "./soakMetrics";

const DEFAULT_MAX_ACTIONS_PER_WEEK = 512;

export const SOAK_PRESETS = {
  smoke: 1,
  short: 3,
  balance: 10,
  long: 30,
} as const;

export type SoakPreset = keyof typeof SOAK_PRESETS;

export interface AdvanceSoakWeekOptions {
  maxActionsPerWeek?: number;
}

export interface AdvanceSoakWeekResult {
  snapshot: CloudGameSnapshot;
  actionCount: number;
  resolvedEvents: number;
  completedMatches: number;
  newInjuryPlayerIds: PlayerId[];
  healedPlayerIds: PlayerId[];
  academicYearTransition: AdvanceWeekOutcome["academicYearTransition"];
}

export interface RunBalanceSoakOptions extends AdvanceSoakWeekOptions {
  seed: string;
  preset: SoakPreset;
}

export interface SoakBalanceObservation {
  code: string;
  message: string;
  yearIndex: number;
}

export interface SoakRunReport {
  metadata: {
    seed: string;
    preset: SoakPreset;
    targetSeasons: number;
    completedSeasons: number;
    completedWeeks: number;
    actions: number;
    schemaVersion: number;
  };
  yearly: SoakSnapshotMetrics[];
  facilityMilestones: SoakFacilityMilestoneSummary;
  observations: SoakBalanceObservation[];
}

export interface SoakRunResult {
  snapshot: CloudGameSnapshot;
  report: SoakRunReport;
  summary: string;
}

interface AppliedSoakAction {
  snapshot: CloudGameSnapshot;
  outcome: unknown;
}

interface SoakYearTracker {
  academicYearIndex: number;
  academicYear: number;
  fundsStart: number;
  fundsMin: number;
  fundsMax: number;
  zeroFundWeeks: number;
  injuredPlayerWeeks: number;
  newInjuries: number;
  healedInjuries: number;
}

export class SoakActionGuardError extends Error {
  constructor(
    public readonly seed: string,
    public readonly date: string,
    public readonly yearIndex: number,
    public readonly weekOfYear: number,
    public readonly actionCount: number,
    public readonly maximum: number,
  ) {
    super(
      `soak failure: seed=${seed} date=${date} action guard exhausted: year=${yearIndex} week=${weekOfYear} actionCount=${actionCount} maxActionsPerWeek=${maximum}`,
    );
    this.name = "SoakActionGuardError";
  }
}

export function createSoakSnapshot(seed: string): CloudGameSnapshot {
  const state = createInitialGame({
    seed,
    schoolName: "Soak高校",
    schoolShortName: "Soak",
    coachName: "Soak監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });

  return {
    userId: `soak:${seed}`,
    schoolDbId: `soak:${seed}`,
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function applyAction(
  snapshot: CloudGameSnapshot,
  action: GameAction,
): AppliedSoakAction {
  const applied = applyGameAction(snapshot, action);
  return {
    snapshot: {
      ...snapshot,
      revision: snapshot.revision + 1,
      state: applied.state,
      teamSelection: applied.teamSelection,
    },
    outcome: applied.outcome,
  };
}

function actionGuardError(
  snapshot: CloudGameSnapshot,
  actionCount: number,
  maximum: number,
): SoakActionGuardError {
  return new SoakActionGuardError(
    snapshot.state.seed,
    snapshot.state.date,
    snapshot.state.yearIndex,
    snapshot.state.calendar.weekOfYear,
    actionCount,
    maximum,
  );
}

function nextAction(snapshot: CloudGameSnapshot): GameAction {
  const pendingEvent = snapshot.state.pendingEvent;
  if (pendingEvent) {
    const choiceId = pendingEvent.choiceIds[0];
    if (!choiceId) {
      throw new Error(
        `soak pending event has no choices: seed=${snapshot.state.seed} date=${snapshot.state.date} event=${pendingEvent.eventId}`,
      );
    }
    return { type: "event-choice", choiceId };
  }

  const activeMatch = snapshot.state.activeMatch;
  if (activeMatch && activeMatch.phase !== "match-complete") {
    if (
      activeMatch.phase !== "coach-decision" ||
      activeMatch.pendingCoachCommandForSchoolId !== snapshot.state.userSchoolId
    ) {
      throw new Error(
        `soak match cannot progress automatically: seed=${snapshot.state.seed} date=${snapshot.state.date} match=${activeMatch.id} phase=${activeMatch.phase}`,
      );
    }
    return { type: "match-command", command: { type: "continue" } };
  }

  return { type: "advance-week" };
}

function advanceWeekOutcome(outcome: unknown): AdvanceWeekOutcome {
  if (
    !outcome ||
    typeof outcome !== "object" ||
    !("weekAdvanced" in outcome) ||
    !("academicYearTransition" in outcome)
  ) {
    throw new Error(
      "soak advance-week did not return an authoritative outcome",
    );
  }
  return outcome as AdvanceWeekOutcome;
}

export function advanceSoakUntilWeekChanges(
  snapshot: CloudGameSnapshot,
  options: AdvanceSoakWeekOptions = {},
): AdvanceSoakWeekResult {
  const maximum = options.maxActionsPerWeek ?? DEFAULT_MAX_ACTIONS_PER_WEEK;
  const startingDate = snapshot.state.date;
  let current = snapshot;
  let actionCount = 0;
  let resolvedEvents = 0;
  let completedMatches = 0;
  const newInjuryPlayerIds = new Set<PlayerId>();
  const healedPlayerIds = new Set<PlayerId>();
  let academicYearTransition: AdvanceWeekOutcome["academicYearTransition"] =
    null;

  while (current.state.date === startingDate) {
    if (actionCount >= maximum) {
      throw actionGuardError(current, actionCount, maximum);
    }

    const action = nextAction(current);
    const historyCount = current.state.history.matches.length;
    const applied = applyAction(current, action);
    const next = applied.snapshot;
    actionCount += 1;
    assertSoakInvariants(next, { actionCount });

    if (action.type === "event-choice") {
      resolvedEvents += 1;
    }
    if (action.type === "advance-week") {
      const outcome = advanceWeekOutcome(applied.outcome);
      for (const playerId of outcome.trainingResult?.injuredPlayerIds ?? []) {
        newInjuryPlayerIds.add(playerId);
      }
      for (const playerId of outcome.healedPlayerIds) {
        healedPlayerIds.add(playerId);
      }
      academicYearTransition =
        outcome.academicYearTransition ?? academicYearTransition;
    }
    completedMatches += Math.max(
      0,
      next.state.history.matches.length - historyCount,
    );

    current = next;
  }

  return {
    snapshot: current,
    actionCount,
    resolvedEvents,
    completedMatches,
    newInjuryPlayerIds: [...newInjuryPlayerIds].sort(),
    healedPlayerIds: [...healedPlayerIds].sort(),
    academicYearTransition,
  };
}

function userFunds(snapshot: CloudGameSnapshot): number {
  return snapshot.state.schools[snapshot.state.userSchoolId]!.funds;
}

function userInjuredPlayerCount(snapshot: CloudGameSnapshot): number {
  const state = snapshot.state;
  const school = state.schools[state.userSchoolId]!;
  return school.playerIds.reduce(
    (count, playerId) => count + (state.players[playerId]?.injury ? 1 : 0),
    0,
  );
}

function createYearTracker(snapshot: CloudGameSnapshot): SoakYearTracker {
  const funds = userFunds(snapshot);
  return {
    academicYearIndex: snapshot.state.yearIndex,
    academicYear: snapshot.state.calendar.academicYear,
    fundsStart: funds,
    fundsMin: funds,
    fundsMax: funds,
    zeroFundWeeks: 0,
    injuredPlayerWeeks: 0,
    newInjuries: 0,
    healedInjuries: 0,
  };
}

function observeWeekStart(
  tracker: SoakYearTracker,
  snapshot: CloudGameSnapshot,
): void {
  const funds = userFunds(snapshot);
  tracker.fundsMin = Math.min(tracker.fundsMin, funds);
  tracker.fundsMax = Math.max(tracker.fundsMax, funds);
  if (funds === 0) tracker.zeroFundWeeks += 1;
  tracker.injuredPlayerWeeks += userInjuredPlayerCount(snapshot);
}

function observeSameYearEnd(
  tracker: SoakYearTracker,
  snapshot: CloudGameSnapshot,
): void {
  const funds = userFunds(snapshot);
  tracker.fundsMin = Math.min(tracker.fundsMin, funds);
  tracker.fundsMax = Math.max(tracker.fundsMax, funds);
}

function buildBalanceObservations(
  yearly: readonly SoakSnapshotMetrics[],
): SoakBalanceObservation[] {
  const observations: SoakBalanceObservation[] = [];
  for (const metrics of yearly) {
    if (metrics.zeroFundWeeks > 0 || metrics.fundsMin === 0) {
      observations.push({
        code: "user_funds_zero",
        message: `自校資金が年度内に0となった週が${metrics.zeroFundWeeks}週あります。経済バランスを確認してください。`,
        yearIndex: metrics.yearIndex,
      });
    }
    if (metrics.playerAbility.p90 >= 95) {
      observations.push({
        code: "player_ability_p90_high",
        message: `全選手能力のp90が${metrics.playerAbility.p90}です。成長上限への集中を確認してください。`,
        yearIndex: metrics.yearIndex,
      });
    }
    if (metrics.userStrength > metrics.cpuStrength.p90 + 20) {
      observations.push({
        code: "user_strength_above_cpu_p90",
        message: `自校戦力${metrics.userStrength}がCPU p90 ${metrics.cpuStrength.p90}を大きく上回っています。`,
        yearIndex: metrics.yearIndex,
      });
    }
  }
  return observations;
}

function formatRunSummary(report: SoakRunReport): string {
  const finalMetrics = report.yearly.at(-1);
  const finalDetail = finalMetrics
    ? `final-year=${finalMetrics.yearIndex} funds=${finalMetrics.fundsStart}->${finalMetrics.fundsEnd} min=${finalMetrics.fundsMin} max=${finalMetrics.fundsMax} strength=${finalMetrics.userStrength} cpu-p50=${finalMetrics.cpuStrength.p50} growth=${finalMetrics.yearlyGrowthTotal} tournament=${finalMetrics.userBestTournamentRound ?? "none"} intake=${finalMetrics.intakeCount} injuries=${finalMetrics.newInjuries}/${finalMetrics.healedInjuries}`
    : "no-yearly-metrics";
  const facilityDetail = finalMetrics
    ? `facilities=${Object.entries(finalMetrics.facilities)
        .map(([facility, level]) => `${facility}:${level}`)
        .join(",")}`
    : "facilities=none";
  const coachDetail = finalMetrics?.assistantCoach
    ? `coach=${finalMetrics.assistantCoach.rank}/${finalMetrics.assistantCoach.specialty ?? "general"}`
    : "coach=none";
  return [
    `seed=${report.metadata.seed}`,
    `preset=${report.metadata.preset}`,
    `seasons=${report.metadata.completedSeasons}/${report.metadata.targetSeasons}`,
    `weeks=${report.metadata.completedWeeks}`,
    `actions=${report.metadata.actions}`,
    finalDetail,
    facilityDetail,
    coachDetail,
    `observations=${report.observations.length}`,
  ].join(" | ");
}

function throwRunHorizonError(
  snapshot: CloudGameSnapshot,
  completedWeeks: number,
  maximumWeeks: number,
): never {
  throw new Error(
    `soak season guard exhausted: seed=${snapshot.state.seed} date=${snapshot.state.date} year=${snapshot.state.yearIndex} week=${snapshot.state.calendar.weekOfYear} completedWeeks=${completedWeeks} maxWeeks=${maximumWeeks}`,
  );
}

export function runBalanceSoak(options: RunBalanceSoakOptions): SoakRunResult {
  const targetSeasons = SOAK_PRESETS[options.preset];
  let snapshot = createSoakSnapshot(options.seed);
  const startingYearIndex = snapshot.state.yearIndex;
  const targetYearIndex = startingYearIndex + targetSeasons;
  const maximumWeeks = targetSeasons * 60 + 4;
  const yearly: SoakSnapshotMetrics[] = [];
  let tracker = createYearTracker(snapshot);
  let completedWeeks = 0;
  let actions = 0;

  assertSoakInvariants(snapshot, { actionCount: actions });

  while (snapshot.state.yearIndex < targetYearIndex) {
    if (completedWeeks >= maximumWeeks) {
      throwRunHorizonError(snapshot, completedWeeks, maximumWeeks);
    }

    const previousYearIndex = snapshot.state.yearIndex;
    observeWeekStart(tracker, snapshot);
    const advanced = advanceSoakUntilWeekChanges(snapshot, {
      maxActionsPerWeek: options.maxActionsPerWeek,
    });
    tracker.newInjuries += advanced.newInjuryPlayerIds.length;
    tracker.healedInjuries += advanced.healedPlayerIds.length;
    actions += advanced.actionCount;
    completedWeeks += 1;
    snapshot = advanced.snapshot;
    assertSoakInvariants(snapshot, { actionCount: actions });

    if (snapshot.state.yearIndex === previousYearIndex) {
      observeSameYearEnd(tracker, snapshot);
      continue;
    }

    const intakePlayerIds =
      advanced.academicYearTransition?.intakePlayerIdsBySchool[
        snapshot.state.userSchoolId
      ] ?? [];
    yearly.push(
      captureSoakSnapshotMetrics(snapshot, {
        academicYearIndex: tracker.academicYearIndex,
        academicYear: tracker.academicYear,
        fundsStart: tracker.fundsStart,
        fundsMin: tracker.fundsMin,
        fundsMax: tracker.fundsMax,
        zeroFundWeeks: tracker.zeroFundWeeks,
        injuredPlayerWeeks: tracker.injuredPlayerWeeks,
        newInjuries: tracker.newInjuries,
        healedInjuries: tracker.healedInjuries,
        intakePlayerIds,
      }),
    );
    tracker = createYearTracker(snapshot);
  }

  const completedSeasons = snapshot.state.yearIndex - startingYearIndex;
  const observations = buildBalanceObservations(yearly);
  const facilityMilestones = summarizeFacilityMilestones(yearly);
  const report: SoakRunReport = {
    metadata: {
      seed: options.seed,
      preset: options.preset,
      targetSeasons,
      completedSeasons,
      completedWeeks,
      actions,
      schemaVersion: snapshot.state.schemaVersion,
    },
    yearly,
    facilityMilestones,
    observations,
  };

  return {
    snapshot,
    report,
    summary: formatRunSummary(report),
  };
}

export type { SoakInvariantViolation };
