import { z } from "zod";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";
import type {
  PlayerId,
  SchoolId,
} from "../../src/domain/model/identifiers";
import type { FacilityKey } from "../../src/domain/school/facilityUpgrade";
import type { WeeklyPlan } from "../../src/domain/training/resolveWeeklyTraining";
import type { PersistedOperationResponse } from "../data/GameStore";

const playerIdSchema = z.string().min(1);

const teamSelectionSchema = z
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

const gameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("training"), plan: weeklyPlanSchema }).strict(),
  z
    .object({
      type: z.literal("team-selection"),
      selection: teamSelectionSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("set-team-leadership"),
      captainPlayerId: playerIdSchema,
      viceCaptainPlayerId: playerIdSchema,
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
  z.object({ type: z.literal("advance-week") }).strict(),
  z
    .object({ type: z.literal("facility-upgrade"), facility: facilitySchema })
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
  | { type: "team-selection"; selection: TeamSelection }
  | {
      type: "set-team-leadership";
      captainPlayerId: PlayerId;
      viceCaptainPlayerId: PlayerId;
    }
  | { type: "practice-match" }
  | { type: "practice-offer-accept" }
  | { type: "practice-offer-decline" }
  | { type: "practice-request"; schoolId: SchoolId }
  | { type: "official-match" }
  | { type: "advance-week" }
  | { type: "facility-upgrade"; facility: FacilityKey }
  | { type: "event-choice"; choiceId: string };

export interface GameActionRequest {
  operationId: string;
  revision: number;
  action: GameAction;
}

export type GameActionResponse = PersistedOperationResponse;
