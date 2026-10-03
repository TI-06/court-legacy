import { z } from "zod";
import type { MatchCommand } from "../../src/domain/model/Match";
import type { SeasonAmbition } from "../../src/domain/season/seasonGoalTypes";
import type { PlayerOpportunityResponse } from "../../src/domain/dynamics/playerOpportunityPromises";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";
import type {
  AssistantCoachRank,
  AssistantCoachSpecialty,
} from "../../src/domain/model/SchoolManagement";
import type { PlayerId, SchoolId } from "../../src/domain/model/identifiers";
import type {
  FacilityKey,
  FacilityUpgradeLevels,
} from "../../src/domain/school/facilityUpgrade";
import type { SchoolSpecialProjectId } from "../../src/domain/school/schoolSpecialProjects";
import type { MatchTacticPlan } from "../../src/domain/team/matchTactics";
import type {
  PlayerDevelopmentGoal,
  SavedLineupSlot,
  TeamIdentityStyle,
} from "../../src/domain/team/teamPlanningTypes";
import type { WeeklyPlan } from "../../src/domain/training/resolveWeeklyTraining";
import type { PersistedOperationResponse } from "../data/GameStore";
import type { JsonStatePatchOperation } from "../data/statePatch";

const playerIdSchema = z.string().min(1);
const positionSchema = z.enum(["OH", "MB", "OP", "S", "L"]);

export const teamSelectionSchema = z
  .object({
    rotation: z
      .array(
        z
          .object({
            slot: z.union([
              z.literal(1),
              z.literal(2),
              z.literal(3),
              z.literal(4),
              z.literal(5),
              z.literal(6),
            ]),
            playerId: playerIdSchema,
          })
          .strict(),
      )
      .length(6),
    liberoPlayerId: playerIdSchema.nullable(),
    benchPlayerIds: z.array(playerIdSchema),
    servingOrderPlayerIds: z.array(playerIdSchema).length(6),
    substitutionPolicy: z
      .object({
        starterLockPlayerIds: z.array(playerIdSchema),
        allowFatigueBenching: z.boolean(),
        allowInjuryBenching: z.boolean(),
        automaticSubstitutions: z.boolean(),
        automaticSetChanges: z.boolean(),
      })
      .strict(),
  })
  .strict();

const weeklyPlanSchema = z
  .object({
    teamTrainingMenuId: z.string().min(1),
    individualAssignments: z.array(
      z
        .object({
          playerId: playerIdSchema,
          instructionId: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();

const facilitySchema = z.enum([
  "gym",
  "trainingRoom",
  "analysisRoom",
  "recoveryRoom",
  "dormitory",
  "scoutingNetwork",
  "alumniAssociation",
  "studyRoom",
]);
const facilityUpgradeLevelsSchema = z.union([
  z.literal(1),
  z.literal(5),
  z.literal(10),
]);

const assistantCoachRankSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "master",
]);

const assistantCoachSpecialtySchema = z.enum(["attack", "defense", "physical"]);
const schoolInvestmentCategorySchema = z.enum([
  "development",
  "external-coach",
  "camp",
  "scouting",
]);
const schoolInvestmentOptionSchema = z.enum([
  "attack",
  "defense",
  "physical",
  "attacker",
  "setter",
  "blocker",
  "libero",
  "intensive",
  "elite",
  "regional",
  "national",
]);
const schoolSpecialProjectIdSchema = z.enum([
  "national-data-bank",
  "medical-support",
  "alumni-development",
  "academic-support",
  "elite-expedition",
  "university-joint-training",
  "top-team-clinic",
  "invitational-cup",
]);
const savedLineupSlotSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
const developmentGoalSchema = z
  .object({
    area: z.enum(["attack", "defense", "jump", "stamina", "mental"]),
    targetGrade: z.enum(["S", "A", "B", "C", "D", "E", "F", "G"]),
  })
  .strict();
const savedLineupNameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(24));

const playerOpportunityResponseSchema = z
  .object({
    playerId: playerIdSchema,
    choice: z.enum(["starter", "substitute", "next-match", "decline"]),
  })
  .strict();

export const matchTacticPlanSchema = z
  .object({
    serve: z.enum(["safe", "balanced", "aggressive"]),
    attack: z.enum(["side", "balanced", "quick"]),
    block: z.enum(["commit", "mixed", "read"]),
  })
  .strict();

const matchCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("timeout") }).strict(),
  z
    .object({
      type: z.literal("set-match-tactics"),
      plan: matchTacticPlanSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("focus-attacker"),
      playerId: playerIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("encourage-player"),
      playerId: playerIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("substitute"),
      outgoingPlayerId: playerIdSchema,
      incomingPlayerId: playerIdSchema,
    })
    .strict(),
  z.object({ type: z.literal("continue") }).strict(),
  z.object({ type: z.literal("skip-to-result") }).strict(),
]);

const gameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("training"), plan: weeklyPlanSchema }).strict(),
  z
    .object({
      type: z.literal("set-season-ambition"),
      ambition: z.enum(["steady", "challenge", "bold"]),
    })
    .strict(),
  z
    .object({ type: z.literal("set-training-plan"), plan: weeklyPlanSchema })
    .strict(),
  z
    .object({
      type: z.literal("team-selection"),
      selection: teamSelectionSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("set-team-tactics"),
      plan: matchTacticPlanSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("set-team-identity"),
      style: z.enum([
        "quick-combination",
        "serve-block",
        "defense-rally",
        "ace-centered",
        "balanced",
      ]),
    })
    .strict(),
  z
    .object({
      type: z.literal("set-team-defense-bias"),
      defenseBias: z.enum(["line", "balanced", "cross"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("set-team-leadership"),
      captainPlayerId: playerIdSchema,
      viceCaptainPlayerId: playerIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("set-development-priorities"),
      playerIds: z.array(playerIdSchema).max(3),
    })
    .strict(),
  z
    .object({
      type: z.literal("set-player-development-goal"),
      playerId: playerIdSchema,
      goal: developmentGoalSchema.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("start-position-conversion"),
      playerId: playerIdSchema,
      targetPosition: positionSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("cancel-position-conversion"),
      playerId: playerIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("save-lineup-preset"),
      slot: savedLineupSlotSchema,
      name: savedLineupNameSchema,
      selection: teamSelectionSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("delete-lineup-preset"),
      slot: savedLineupSlotSchema,
    })
    .strict(),
  z.object({ type: z.literal("practice-match") }).strict(),
  z
    .object({ type: z.literal("match-command"), command: matchCommandSchema })
    .strict(),
  z.object({ type: z.literal("practice-offer-accept") }).strict(),
  z.object({ type: z.literal("practice-offer-decline") }).strict(),
  z
    .object({
      type: z.literal("practice-request"),
      schoolId: z.string().min(1),
    })
    .strict(),
  z.object({ type: z.literal("official-match") }).strict(),
  z
    .object({
      type: z.literal("advance-week"),
      matchSelection: teamSelectionSchema.optional(),
      matchTactics: matchTacticPlanSchema.optional(),
      playerOpportunityResponses: z
        .array(playerOpportunityResponseSchema)
        .max(3)
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("mark-notification-read"),
      notificationId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("facility-upgrade"),
      facility: facilitySchema,
      levels: facilityUpgradeLevelsSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("assistant-coach-contract"),
      rank: assistantCoachRankSchema,
      specialty: assistantCoachSpecialtySchema.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("school-investment"),
      category: schoolInvestmentCategorySchema,
      option: schoolInvestmentOptionSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("school-special-project"),
      projectId: schoolSpecialProjectIdSchema,
      targetPlayerId: playerIdSchema.optional(),
      option: z.string().trim().min(1).max(40).optional(),
    })
    .strict(),
  z
    .object({ type: z.literal("event-choice"), choiceId: z.string().min(1) })
    .strict(),
  z.object({ type: z.literal("acknowledge-training-camp-result") }).strict(),
]);

export const gameActionRequestSchema = z
  .object({
    operationId: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().min(1).max(120)),
    revision: z.number().int().positive(),
    action: gameActionSchema,
  })
  .strict();

export type GameAction =
  | { type: "training"; plan: WeeklyPlan }
  | { type: "set-season-ambition"; ambition: SeasonAmbition }
  | { type: "set-training-plan"; plan: WeeklyPlan }
  | { type: "team-selection"; selection: TeamSelection }
  | { type: "set-team-tactics"; plan: MatchTacticPlan }
  | { type: "set-team-identity"; style: TeamIdentityStyle }
  | {
      type: "set-team-defense-bias";
      defenseBias: "line" | "balanced" | "cross";
    }
  | {
      type: "set-team-leadership";
      captainPlayerId: PlayerId;
      viceCaptainPlayerId: PlayerId;
    }
  | { type: "set-development-priorities"; playerIds: PlayerId[] }
  | {
      type: "set-player-development-goal";
      playerId: PlayerId;
      goal: PlayerDevelopmentGoal | null;
    }
  | {
      type: "start-position-conversion";
      playerId: PlayerId;
      targetPosition: "OH" | "MB" | "OP" | "S" | "L";
    }
  | { type: "cancel-position-conversion"; playerId: PlayerId }
  | {
      type: "save-lineup-preset";
      slot: SavedLineupSlot;
      name: string;
      selection: TeamSelection;
    }
  | { type: "delete-lineup-preset"; slot: SavedLineupSlot }
  | { type: "practice-match" }
  | { type: "match-command"; command: MatchCommand }
  | { type: "practice-offer-accept" }
  | { type: "practice-offer-decline" }
  | { type: "practice-request"; schoolId: SchoolId }
  | { type: "official-match" }
  | {
      type: "advance-week";
      matchSelection?: TeamSelection;
      matchTactics?: MatchTacticPlan;
      playerOpportunityResponses?: PlayerOpportunityResponse[];
    }
  | { type: "mark-notification-read"; notificationId: string }
  | {
      type: "facility-upgrade";
      facility: FacilityKey;
      levels?: FacilityUpgradeLevels;
    }
  | {
      type: "assistant-coach-contract";
      rank: AssistantCoachRank;
      specialty: AssistantCoachSpecialty | null;
    }
  | {
      type: "school-investment";
      category: "development" | "external-coach" | "camp" | "scouting";
      option:
        | "attack"
        | "defense"
        | "physical"
        | "attacker"
        | "setter"
        | "blocker"
        | "libero"
        | "intensive"
        | "elite"
        | "regional"
        | "national";
    }
  | {
      type: "school-special-project";
      projectId: SchoolSpecialProjectId;
      targetPlayerId?: PlayerId;
      option?: string;
    }
  | { type: "event-choice"; choiceId: string }
  | { type: "acknowledge-training-camp-result" };

export interface GameActionRequest {
  operationId: string;
  revision: number;
  action: GameAction;
}

export interface DeltaGameActionResponse {
  operationId: string;
  gameDelta: {
    userId: string;
    schoolDbId: string;
    revision: number;
    statePatch: JsonStatePatchOperation[];
    teamSelection: TeamSelection;
  };
  outcome?: unknown;
}

export type GameActionResponse =
  PersistedOperationResponse | DeltaGameActionResponse;
