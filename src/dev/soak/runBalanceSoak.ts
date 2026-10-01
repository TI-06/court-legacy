import { createInitialGame } from "../../app/createInitialGame";
import { gameDataBootstrap } from "../../data/gameData";
import type { EventChoiceDefinition } from "../../domain/validation/gameDataSchema";
import type { AdvanceWeekOutcome } from "../../domain/calendar/advanceWeekOutcome";
import type { PlayerId } from "../../domain/model/identifiers";
import {
  SPECIAL_ABILITIES,
  type SpecialAbilityKind,
} from "../../domain/player/specialAbilities";
import { evaluateAssistantCoachContract } from "../../domain/school/assistantCoach";
import { evaluateSchoolInvestment } from "../../domain/school/schoolInvestment";
import {
  SCHOOL_SPECIAL_PROJECT_DEFINITIONS,
  evaluateSchoolSpecialProject,
  type SchoolSpecialProjectId,
} from "../../domain/school/schoolSpecialProjects";
import {
  activeInvitationalCup,
  createInvitationalCup,
} from "../../domain/school/invitationalCup";
import { selectEliteExpeditionOpponent } from "../../domain/school/specialProjectActivities";
import { findDueUserOfficialMatch } from "../../domain/tournament/progressOfficialTournaments";
import {
  FACILITY_DEFINITIONS,
  evaluateFacilityUpgrade,
} from "../../domain/school/facilityUpgrade";
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
const SOAK_MANAGEMENT_RESERVE = 300;

const COACH_POLICY: readonly Extract<
  GameAction,
  { type: "assistant-coach-contract" }
>[] = [
  { type: "assistant-coach-contract", rank: "master", specialty: "attack" },
  {
    type: "assistant-coach-contract",
    rank: "advanced",
    specialty: "attack",
  },
  {
    type: "assistant-coach-contract",
    rank: "intermediate",
    specialty: "attack",
  },
  { type: "assistant-coach-contract", rank: "beginner", specialty: null },
];

const COACH_SPECIALTIES = ["attack", "defense", "physical"] as const;
const INVESTMENT_DEVELOPMENT_FOCUSES = [
  "attack",
  "defense",
  "physical",
] as const;
const INVESTMENT_EXTERNAL_SPECIALISTS = [
  "attacker",
  "setter",
  "blocker",
  "libero",
] as const;

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

export interface SoakSpecialAbilityFlow {
  normalAcquired: number;
  rareAcquired: number;
  superRareAcquired: number;
  superRareFromEvent: number;
  superRareFromMatch: number;
  superRareFromOther: number;
  negativeAcquired: number;
  negativeRecovered: number;
}

export interface AdvanceSoakWeekResult {
  snapshot: CloudGameSnapshot;
  actionCount: number;
  resolvedEvents: number;
  completedMatches: number;
  newInjuryPlayerIds: PlayerId[];
  healedPlayerIds: PlayerId[];
  specialAbilityFlow: SoakSpecialAbilityFlow;
  academicYearTransition: AdvanceWeekOutcome["academicYearTransition"];
}

export interface SoakManagementPolicyResult {
  snapshot: CloudGameSnapshot;
  actionCount: number;
  specialProjectIds: SchoolSpecialProjectId[];
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
    initialSaveBytes: number;
    finalSaveBytes: number;
    maxObservedSaveBytes: number;
  };
  yearly: SoakSnapshotMetrics[];
  facilityMilestones: SoakFacilityMilestoneSummary;
  specialAbilityFlow: SoakSpecialAbilityFlow;
  specialProjectPurchases: Record<SchoolSpecialProjectId, number>;
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
  assistantCoach: SoakSnapshotMetrics["assistantCoach"];
  assistantCoachSignature: string | null;
  assistantCoachChanges: number;
  growthTypeByPlayerId: Record<string, string>;
  nationalParticipantStrengthValues: number[];
  observedNationalTournamentIds: Set<string>;
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

const SPECIAL_ABILITY_KIND_BY_ID: ReadonlyMap<string, SpecialAbilityKind> =
  new Map(
    SPECIAL_ABILITIES.map((ability) => [ability.id, ability.kind] as const),
  );

function emptySpecialProjectPurchases(): Record<
  SchoolSpecialProjectId,
  number
> {
  return Object.fromEntries(
    SCHOOL_SPECIAL_PROJECT_DEFINITIONS.map((definition) => [definition.id, 0]),
  ) as Record<SchoolSpecialProjectId, number>;
}

function emptySpecialAbilityFlow(): SoakSpecialAbilityFlow {
  return {
    normalAcquired: 0,
    rareAcquired: 0,
    superRareAcquired: 0,
    superRareFromEvent: 0,
    superRareFromMatch: 0,
    superRareFromOther: 0,
    negativeAcquired: 0,
    negativeRecovered: 0,
  };
}

function addSpecialAbilityFlow(
  target: SoakSpecialAbilityFlow,
  delta: SoakSpecialAbilityFlow,
): void {
  target.normalAcquired += delta.normalAcquired;
  target.rareAcquired += delta.rareAcquired;
  target.superRareAcquired += delta.superRareAcquired;
  target.superRareFromEvent += delta.superRareFromEvent;
  target.superRareFromMatch += delta.superRareFromMatch;
  target.superRareFromOther += delta.superRareFromOther;
  target.negativeAcquired += delta.negativeAcquired;
  target.negativeRecovered += delta.negativeRecovered;
}

export function observeSoakSpecialAbilityFlow(
  before: CloudGameSnapshot,
  after: CloudGameSnapshot,
): SoakSpecialAbilityFlow {
  const flow = emptySpecialAbilityFlow();
  const beforeSchool = before.state.schools[before.state.userSchoolId]!;
  const afterSchool = after.state.schools[after.state.userSchoolId]!;
  const afterRoster = new Set(afterSchool.playerIds);

  for (const playerId of beforeSchool.playerIds) {
    if (!afterRoster.has(playerId)) continue;
    const beforePlayer = before.state.players[playerId];
    const afterPlayer = after.state.players[playerId];
    if (!beforePlayer || !afterPlayer) continue;

    const beforeIds = new Set(beforePlayer.specialAbilityIds ?? []);
    const afterIds = new Set(afterPlayer.specialAbilityIds ?? []);

    for (const abilityId of afterIds) {
      if (beforeIds.has(abilityId)) continue;
      const kind = SPECIAL_ABILITY_KIND_BY_ID.get(abilityId);
      if (kind === "positive") flow.normalAcquired += 1;
      else if (kind === "elite") flow.rareAcquired += 1;
      else if (kind === "gold") flow.superRareAcquired += 1;
      else if (kind === "negative") flow.negativeAcquired += 1;
    }

    for (const abilityId of beforeIds) {
      if (afterIds.has(abilityId)) continue;
      if (SPECIAL_ABILITY_KIND_BY_ID.get(abilityId) === "negative") {
        flow.negativeRecovered += 1;
      }
    }
  }

  return flow;
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

function userFunds(snapshot: CloudGameSnapshot): number {
  return snapshot.state.schools[snapshot.state.userSchoolId]!.funds;
}

function currentAssistantCoach(
  snapshot: CloudGameSnapshot,
): SoakSnapshotMetrics["assistantCoach"] {
  const coach = snapshot.state.schoolManagement.assistantCoach;
  return coach
    ? {
        rank: coach.rank,
        specialty: coach.specialty,
        contractYearIndex: coach.contractYearIndex,
      }
    : null;
}

function coachSignature(
  coach: SoakSnapshotMetrics["assistantCoach"],
): string | null {
  return coach
    ? `${coach.rank}/${coach.specialty ?? "general"}/${coach.contractYearIndex}`
    : null;
}

function coachActionForCurrentYear(
  snapshot: CloudGameSnapshot,
): Extract<GameAction, { type: "assistant-coach-contract" }> | null {
  const state = snapshot.state;
  const currentCoach = state.schoolManagement.assistantCoach;
  if (currentCoach?.contractYearIndex === state.yearIndex) return null;

  const specialty = COACH_SPECIALTIES[(state.yearIndex - 1) % 3]!;
  for (const candidate of COACH_POLICY) {
    const action =
      candidate.rank === "beginner" ? candidate : { ...candidate, specialty };
    const evaluation = evaluateAssistantCoachContract(
      state,
      action.rank,
      action.specialty,
    );
    if (
      evaluation.allowed &&
      evaluation.fundsAfter >= SOAK_MANAGEMENT_RESERVE
    ) {
      return action;
    }
  }
  return null;
}

function schoolInvestmentAction(
  snapshot: CloudGameSnapshot,
): Extract<GameAction, { type: "school-investment" }> | null {
  const yearOffset = snapshot.state.yearIndex - 1;
  const candidates: readonly Extract<
    GameAction,
    { type: "school-investment" }
  >[] = [
    {
      type: "school-investment",
      category: "development",
      option:
        INVESTMENT_DEVELOPMENT_FOCUSES[
          yearOffset % INVESTMENT_DEVELOPMENT_FOCUSES.length
        ]!,
    },
    {
      type: "school-investment",
      category: "external-coach",
      option:
        INVESTMENT_EXTERNAL_SPECIALISTS[
          yearOffset % INVESTMENT_EXTERNAL_SPECIALISTS.length
        ]!,
    },
    { type: "school-investment", category: "camp", option: "elite" },
    { type: "school-investment", category: "scouting", option: "national" },
  ];

  for (const candidate of candidates) {
    const evaluation = evaluateSchoolInvestment(
      snapshot.state,
      candidate.category,
      candidate.option,
    );
    if (
      evaluation.allowed &&
      evaluation.fundsAfter >= SOAK_MANAGEMENT_RESERVE
    ) {
      return candidate;
    }
  }
  return null;
}

const SPECIAL_PROJECT_POLICY = SCHOOL_SPECIAL_PROJECT_DEFINITIONS.map(
  (definition) => definition.id,
);

function specialProjectAction(
  snapshot: CloudGameSnapshot,
): Extract<GameAction, { type: "school-special-project" }> | null {
  const state = snapshot.state;
  const yearOffset = Math.max(0, state.yearIndex - 1);
  const ordered = SPECIAL_PROJECT_POLICY.map(
    (_, index) =>
      SPECIAL_PROJECT_POLICY[(index + yearOffset) % SPECIAL_PROJECT_POLICY.length]!,
  );

  for (const projectId of ordered) {
    const definition = SCHOOL_SPECIAL_PROJECT_DEFINITIONS.find(
      (candidate) => candidate.id === projectId,
    )!;
    if (!definition.effectReady) continue;

    const evaluation = evaluateSchoolSpecialProject(state, projectId);
    if (
      !evaluation.allowed ||
      evaluation.fundsAfter < SOAK_MANAGEMENT_RESERVE
    ) {
      continue;
    }

    if (
      projectId === "elite-expedition" ||
      projectId === "invitational-cup"
    ) {
      if (
        findDueUserOfficialMatch(state) ||
        state.weeklySchedule.practiceMatch.scheduledOpponentId ||
        (state.activeMatch && state.activeMatch.phase !== "match-complete")
      ) {
        continue;
      }
    }

    if (projectId === "elite-expedition") {
      if (!selectEliteExpeditionOpponent(state)) continue;
      return { type: "school-special-project", projectId };
    }

    if (projectId === "invitational-cup") {
      if (
        activeInvitationalCup(state)?.currentRound ||
        !createInvitationalCup(state)
      ) {
        continue;
      }
      return { type: "school-special-project", projectId };
    }

    if (projectId === "university-joint-training") {
      if (
        state.schoolManagement.specialProjects?.pendingUniversityJointTraining
      ) {
        continue;
      }
      const option =
        INVESTMENT_DEVELOPMENT_FOCUSES[
          yearOffset % INVESTMENT_DEVELOPMENT_FOCUSES.length
        ]!;
      return {
        type: "school-special-project",
        projectId,
        option,
      };
    }

    if (projectId === "top-team-clinic") {
      const school = state.schools[state.userSchoolId]!;
      const targetPlayerId = school.playerIds.find(
        (playerId) => state.players[playerId] && !state.players[playerId]!.injury,
      );
      if (!targetPlayerId) continue;
      const focuses = [
        "attack",
        "defense",
        "serve",
        "setting",
        "block",
        "mental",
      ] as const;
      return {
        type: "school-special-project",
        projectId,
        targetPlayerId,
        option: focuses[yearOffset % focuses.length]!,
      };
    }

    return { type: "school-special-project", projectId };
  }

  return null;
}

function facilityAction(
  snapshot: CloudGameSnapshot,
): Extract<GameAction, { type: "facility-upgrade" }> | null {
  const state = snapshot.state;
  const school = state.schools[state.userSchoolId]!;
  const ordered = [...FACILITY_DEFINITIONS].sort((left, right) => {
    const levelDifference =
      school.facilities[left.key] - school.facilities[right.key];
    if (levelDifference !== 0) return levelDifference;
    return (
      FACILITY_DEFINITIONS.findIndex(
        (definition) => definition.key === left.key,
      ) -
      FACILITY_DEFINITIONS.findIndex(
        (definition) => definition.key === right.key,
      )
    );
  });

  for (const definition of ordered) {
    const evaluation = evaluateFacilityUpgrade(
      state,
      state.userSchoolId,
      definition.key,
    );
    if (
      evaluation.allowed &&
      evaluation.fundsAfter >= SOAK_MANAGEMENT_RESERVE
    ) {
      return { type: "facility-upgrade", facility: definition.key };
    }
  }
  return null;
}

export function applySoakManagementPolicy(
  snapshot: CloudGameSnapshot,
): SoakManagementPolicyResult {
  if (
    snapshot.state.pendingEvent ||
    (snapshot.state.activeMatch &&
      snapshot.state.activeMatch.phase !== "match-complete")
  ) {
    return { snapshot, actionCount: 0, specialProjectIds: [] };
  }

  let current = snapshot;
  let actionCount = 0;
  const specialProjectIds: SchoolSpecialProjectId[] = [];

  const coachAction = coachActionForCurrentYear(current);
  if (coachAction) {
    current = applyAction(current, coachAction).snapshot;
    actionCount += 1;
    assertSoakInvariants(current, { actionCount });
  }

  const nextFacilityAction = facilityAction(current);
  if (nextFacilityAction) {
    current = applyAction(current, nextFacilityAction).snapshot;
    actionCount += 1;
    assertSoakInvariants(current, { actionCount });
  }

  for (let investmentIndex = 0; investmentIndex < 4; investmentIndex += 1) {
    const nextInvestmentAction = schoolInvestmentAction(current);
    if (!nextInvestmentAction) break;
    current = applyAction(current, nextInvestmentAction).snapshot;
    actionCount += 1;
    assertSoakInvariants(current, { actionCount });
  }

  for (let projectIndex = 0; projectIndex < 2; projectIndex += 1) {
    const nextProjectAction = specialProjectAction(current);
    if (!nextProjectAction) break;
    const applied = applyAction(current, nextProjectAction);
    current = applied.snapshot;
    specialProjectIds.push(nextProjectAction.projectId);
    actionCount += 1;
    assertSoakInvariants(current, { actionCount });
  }

  return { snapshot: current, actionCount, specialProjectIds };
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

function requiredFundsForEventChoice(choice: EventChoiceDefinition): number {
  let runningFundsDelta = 0;
  let minimumFundsDelta = 0;
  for (const effect of choice.effects) {
    if (effect.type !== "funds-change") continue;
    runningFundsDelta += effect.amount;
    minimumFundsDelta = Math.min(minimumFundsDelta, runningFundsDelta);
  }
  return Math.abs(minimumFundsDelta);
}

function soakEventChoiceId(snapshot: CloudGameSnapshot): string {
  const pendingEvent = snapshot.state.pendingEvent;
  if (!pendingEvent) {
    throw new Error("soak event choice requested without a pending event");
  }
  if (!gameDataBootstrap.ok) {
    throw new Error(gameDataBootstrap.message);
  }

  const event = gameDataBootstrap.data.events.get(pendingEvent.eventId);
  if (!event) {
    throw new Error(
      `soak event definition missing: seed=${snapshot.state.seed} date=${snapshot.state.date} event=${pendingEvent.eventId}`,
    );
  }

  const pendingChoiceIds = new Set(pendingEvent.choiceIds);
  const choices = event.choices.filter((choice) =>
    pendingChoiceIds.has(choice.id),
  );
  if (choices.length === 0) {
    throw new Error(
      `soak pending event has no choices: seed=${snapshot.state.seed} date=${snapshot.state.date} event=${pendingEvent.eventId}`,
    );
  }

  const availableFunds = userFunds(snapshot);
  const affordable = choices.find(
    (choice) => requiredFundsForEventChoice(choice) <= availableFunds,
  );
  if (affordable) return affordable.id;

  return [...choices].sort(
    (left, right) =>
      requiredFundsForEventChoice(left) - requiredFundsForEventChoice(right),
  )[0]!.id;
}

function nextAction(snapshot: CloudGameSnapshot): GameAction {
  const pendingEvent = snapshot.state.pendingEvent;
  if (pendingEvent) {
    return { type: "event-choice", choiceId: soakEventChoiceId(snapshot) };
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
  const specialAbilityFlow = emptySpecialAbilityFlow();
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
    const specialAbilityDelta = observeSoakSpecialAbilityFlow(current, next);
    if (specialAbilityDelta.superRareAcquired > 0) {
      if (action.type === "event-choice") {
        specialAbilityDelta.superRareFromEvent +=
          specialAbilityDelta.superRareAcquired;
      } else if (action.type === "match-command") {
        specialAbilityDelta.superRareFromMatch +=
          specialAbilityDelta.superRareAcquired;
      } else {
        specialAbilityDelta.superRareFromOther +=
          specialAbilityDelta.superRareAcquired;
      }
    }
    addSpecialAbilityFlow(specialAbilityFlow, specialAbilityDelta);
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
    specialAbilityFlow,
    academicYearTransition,
  };
}

function userInjuredPlayerCount(snapshot: CloudGameSnapshot): number {
  const state = snapshot.state;
  const school = state.schools[state.userSchoolId]!;
  return school.playerIds.reduce(
    (count, playerId) => count + (state.players[playerId]?.injury ? 1 : 0),
    0,
  );
}

function createGrowthTypeMap(
  snapshot: CloudGameSnapshot,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(snapshot.state.players).map(([playerId, player]) => [
      playerId,
      player.growthTypeId,
    ]),
  );
}

function createYearTracker(snapshot: CloudGameSnapshot): SoakYearTracker {
  const funds = userFunds(snapshot);
  const assistantCoach = currentAssistantCoach(snapshot);
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
    assistantCoach,
    assistantCoachSignature: coachSignature(assistantCoach),
    assistantCoachChanges: assistantCoach ? 1 : 0,
    growthTypeByPlayerId: createGrowthTypeMap(snapshot),
    nationalParticipantStrengthValues: [],
    observedNationalTournamentIds: new Set<string>(),
  };
}

function observePlayerGrowthTypes(
  tracker: SoakYearTracker,
  snapshot: CloudGameSnapshot,
): void {
  for (const [playerId, player] of Object.entries(snapshot.state.players)) {
    tracker.growthTypeByPlayerId[playerId] ??= player.growthTypeId;
  }
}

function observeAssistantCoach(
  tracker: SoakYearTracker,
  snapshot: CloudGameSnapshot,
): void {
  const assistantCoach = currentAssistantCoach(snapshot);
  const signature = coachSignature(assistantCoach);
  if (signature !== tracker.assistantCoachSignature) {
    if (assistantCoach) tracker.assistantCoachChanges += 1;
    tracker.assistantCoachSignature = signature;
  }
  tracker.assistantCoach = assistantCoach ?? tracker.assistantCoach;
}

function observeNationalParticipants(
  tracker: SoakYearTracker,
  snapshot: CloudGameSnapshot,
): void {
  const season = snapshot.state.officialSeason;
  if (season.academicYear !== tracker.academicYear) return;

  for (const stage of [season.interhigh.national, season.springHigh.national]) {
    if (
      !stage ||
      stage.entrants.length === 0 ||
      tracker.observedNationalTournamentIds.has(stage.tournamentId)
    ) {
      continue;
    }
    tracker.observedNationalTournamentIds.add(stage.tournamentId);
    tracker.nationalParticipantStrengthValues.push(
      ...stage.entrants.map((entrant) => entrant.seedStrength),
    );
  }
}

function observeWeekStart(
  tracker: SoakYearTracker,
  snapshot: CloudGameSnapshot,
): void {
  observePlayerGrowthTypes(tracker, snapshot);
  observeAssistantCoach(tracker, snapshot);
  observeNationalParticipants(tracker, snapshot);

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
  observePlayerGrowthTypes(tracker, snapshot);
  observeNationalParticipants(tracker, snapshot);

  const funds = userFunds(snapshot);
  tracker.fundsMin = Math.min(tracker.fundsMin, funds);
  tracker.fundsMax = Math.max(tracker.fundsMax, funds);
}

export function buildBalanceObservations(
  yearly: readonly SoakSnapshotMetrics[],
): SoakBalanceObservation[] {
  const observations: SoakBalanceObservation[] = [];
  for (const metrics of yearly) {
    if (metrics.zeroFundWeeks > 0) {
      observations.push({
        code: "user_funds_zero",
        message: `自校資金の年度内最小残高が0です。週境界で0を観測した回数は${metrics.zeroFundWeeks}回です。経済バランスを確認してください。`,
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
    if (
      metrics.nationalParticipantStrength.count > 0 &&
      metrics.userStrength > metrics.nationalParticipantStrength.p90 + 10
    ) {
      observations.push({
        code: "user_strength_above_national_p90",
        message: `自校戦力${metrics.userStrength}が全国出場校 p90 ${metrics.nationalParticipantStrength.p90}を大きく上回っています。`,
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
    ? `coach=${finalMetrics.assistantCoach.rank}/${finalMetrics.assistantCoach.specialty ?? "general"} changes=${finalMetrics.assistantCoachChanges}`
    : `coach=none changes=${finalMetrics?.assistantCoachChanges ?? 0}`;
  const nationalDetail = finalMetrics
    ? `national-participants=${finalMetrics.nationalParticipantStrength.count} national-p50=${finalMetrics.nationalParticipantStrength.p50} national-p90=${finalMetrics.nationalParticipantStrength.p90}`
    : "national-participants=0";
  const specialAbilityDetail = finalMetrics
    ? `special=N${finalMetrics.userSpecialAbilities.normal}/R${finalMetrics.userSpecialAbilities.rare}/SR${finalMetrics.userSpecialAbilities.superRare}/NEG${finalMetrics.userSpecialAbilities.negative} mean=${finalMetrics.userSpecialAbilities.perPlayer.mean} sr-players=${finalMetrics.userSpecialAbilities.playersWithSuperRare}`
    : "special=none";
  const specialFlowDetail = `special-flow=N+${report.specialAbilityFlow.normalAcquired}/R+${report.specialAbilityFlow.rareAcquired}/SR+${report.specialAbilityFlow.superRareAcquired}(event=${report.specialAbilityFlow.superRareFromEvent},match=${report.specialAbilityFlow.superRareFromMatch},other=${report.specialAbilityFlow.superRareFromOther})/NEG+${report.specialAbilityFlow.negativeAcquired}/NEG-recovered=${report.specialAbilityFlow.negativeRecovered}`;
  const projectDetail = `projects=${Object.entries(report.specialProjectPurchases)
    .filter(([, count]) => count > 0)
    .map(([projectId, count]) => `${projectId}:${count}`)
    .join(",") || "none"}`;
  const saveDetail = `save-bytes=${report.metadata.initialSaveBytes}->${report.metadata.finalSaveBytes} max=${report.metadata.maxObservedSaveBytes}`;
  return [
    `seed=${report.metadata.seed}`,
    `preset=${report.metadata.preset}`,
    `seasons=${report.metadata.completedSeasons}/${report.metadata.targetSeasons}`,
    `weeks=${report.metadata.completedWeeks}`,
    `actions=${report.metadata.actions}`,
    finalDetail,
    facilityDetail,
    coachDetail,
    nationalDetail,
    specialAbilityDetail,
    specialFlowDetail,
    projectDetail,
    saveDetail,
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
  const specialAbilityFlow = emptySpecialAbilityFlow();
  const specialProjectPurchases = emptySpecialProjectPurchases();
  const initialSaveBytes = JSON.stringify(snapshot).length;
  let maxObservedSaveBytes = initialSaveBytes;

  assertSoakInvariants(snapshot, { actionCount: actions });

  while (snapshot.state.yearIndex < targetYearIndex) {
    if (completedWeeks >= maximumWeeks) {
      throwRunHorizonError(snapshot, completedWeeks, maximumWeeks);
    }

    const managed = applySoakManagementPolicy(snapshot);
    actions += managed.actionCount;
    for (const projectId of managed.specialProjectIds) {
      specialProjectPurchases[projectId] += 1;
    }
    snapshot = managed.snapshot;
    assertSoakInvariants(snapshot, { actionCount: actions });

    const previousYearIndex = snapshot.state.yearIndex;
    observeWeekStart(tracker, snapshot);
    const advanced = advanceSoakUntilWeekChanges(snapshot, {
      maxActionsPerWeek: options.maxActionsPerWeek,
    });
    tracker.newInjuries += advanced.newInjuryPlayerIds.length;
    tracker.healedInjuries += advanced.healedPlayerIds.length;
    addSpecialAbilityFlow(specialAbilityFlow, advanced.specialAbilityFlow);
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
    const metrics = captureSoakSnapshotMetrics(snapshot, {
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
      growthTypeByPlayerId: tracker.growthTypeByPlayerId,
      nationalParticipantStrengthValues:
        tracker.nationalParticipantStrengthValues,
      assistantCoachChanges: tracker.assistantCoachChanges,
    });
    yearly.push({ ...metrics, assistantCoach: tracker.assistantCoach });
    maxObservedSaveBytes = Math.max(
      maxObservedSaveBytes,
      JSON.stringify(snapshot).length,
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
      initialSaveBytes,
      finalSaveBytes: JSON.stringify(snapshot).length,
      maxObservedSaveBytes,
    },
    yearly,
    facilityMilestones,
    specialAbilityFlow,
    specialProjectPurchases,
    observations,
  };

  return {
    snapshot,
    report,
    summary: formatRunSummary(report),
  };
}

export type { SoakInvariantViolation };
