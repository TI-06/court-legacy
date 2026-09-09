import { z } from "zod";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";
import type {
  AssistantCoachRank,
  AssistantCoachSpecialty,
} from "../../src/domain/model/SchoolManagement";
import type { PlayerId, SchoolId } from "../../src/domain/model/identifiers";
import type { FacilityKey } from "../../src/domain/school/facilityUpgrade";
import type { MatchTacticPlan } from "../../src/domain/team/matchTactics";
import type { SavedLineupSlot } from "../../src/domain/team/teamPlanningTypes";
import type { WeeklyPlan } from "../../src/domain/training/resolveWeeklyTraining";
import type { PersistedOperationResponse } from "../data/GameStore";

const playerIdSchema = z.string().min(1);

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

const assistantCoachRankSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "master",
]);

const assistantCoachSpecialtySchema = z.enum(["attack", "defense", "physical"]);
const savedLineupSlotSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
const savedLineupNameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(24));

export const matchTacticPlanSchema = z
  .object({
    serve: z.enum(["safe", "balanced", "aggressive"]),
    attack: z.enum(["side", "balanced", "quick"]),
    block: z.enum(["commit", "mixed", "read"]),
  })
  .strict();

const gameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("training"), plan: weeklyPlanSchema }).strict(),
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
    })
    .strict(),
  z
    .object({
      type: z.literal("mark-notification-read"),
      notificationId: z.string().min(1),
    })
    .strict(),
  z
    .object({ type: z.literal("facility-upgrade"), facility: facilitySchema })
    .strict(),
  z
    .object({
      type: z.literal("assistant-coach-contract"),
      rank: assistantCoachRankSchema,
      specialty: assistantCoachSpecialtySchema.nullable(),
    })
    .strict(),
  z
    .object({ type: z.literal("event-choice"), choiceId: z.string().min(1) })
    .strict(),
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
  | { type: "set-training-plan"; plan: WeeklyPlan }
  | { type: "team-selection"; selection: TeamSelection }
  | { type: "set-team-tactics"; plan: MatchTacticPlan }
  | {
      type: "set-team-leadership";
      captainPlayerId: PlayerId;
      viceCaptainPlayerId: PlayerId;
    }
  | { type: "set-development-priorities"; playerIds: PlayerId[] }
  | {
      type: "save-lineup-preset";
      slot: SavedLineupSlot;
      name: string;
      selection: TeamSelection;
    }
  | { type: "delete-lineup-preset"; slot: SavedLineupSlot }
  | { type: "practice-match" }
  | { type: "practice-offer-accept" }
  | { type: "practice-offer-decline" }
  | { type: "practice-request"; schoolId: SchoolId }
  | { type: "official-match" }
  | {
      type: "advance-week";
      matchSelection?: TeamSelection;
      matchTactics?: MatchTacticPlan;
    }
  | { type: "mark-notification-read"; notificationId: string }
  | { type: "facility-upgrade"; facility: FacilityKey }
  | {
      type: "assistant-coach-contract";
      rank: AssistantCoachRank;
      specialty: AssistantCoachSpecialty | null;
    }
  | { type: "event-choice"; choiceId: string };

export interface GameActionRequest {
  operationId: string;
  revision: number;
  action: GameAction;
}

export type GameActionResponse = PersistedOperationResponse;
