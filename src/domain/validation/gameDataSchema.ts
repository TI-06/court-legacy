import * as z from "zod";

const dataIdSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/,
    "must use a namespaced lowercase id",
  );

export const abilityKeySchema = z.enum([
  "spike",
  "jump",
  "receive",
  "serve",
  "set",
  "block",
  "speed",
  "stamina",
  "decision",
  "mental",
]);

export const nameEntrySchema = z.object({
  name: z.string().trim().min(1).max(12),
  reading: z.string().trim().min(1).max(24),
  weight: z.number().int().min(1).max(100),
});

export const nameCatalogSchema = z.object({
  surnames: z.array(nameEntrySchema).min(1),
  givenNames: z.array(nameEntrySchema).min(1),
});

export const personalityDefinitionSchema = z.object({
  id: dataIdSchema,
  name: z.string().trim().min(1).max(20),
  description: z.string().trim().min(1).max(160),
  trainingStability: z.number().int().min(-20).max(20),
  moraleVolatility: z.number().int().min(0).max(100),
  relationshipGrowth: z.number().int().min(-20).max(20),
  pressureModifier: z.number().int().min(-20).max(20),
  tags: z.array(z.string().trim().min(1).max(30)).max(8),
});

export const growthTypeDefinitionSchema = z.object({
  id: dataIdSchema,
  name: z.string().trim().min(1).max(20),
  description: z.string().trim().min(1).max(160),
  gradeMultipliers: z.object({
    grade1: z.number().int().min(25).max(200),
    grade2: z.number().int().min(25).max(200),
    grade3: z.number().int().min(25).max(200),
  }),
  practiceMultiplier: z.number().int().min(25).max(200),
  matchMultiplier: z.number().int().min(25).max(200),
});

const abilityModifierEffectSchema = z.object({
  type: z.literal("ability-modifier"),
  ability: abilityKeySchema,
  value: z.number().int().min(-100).max(100),
});

const situationModifierEffectSchema = z.object({
  type: z.literal("situation-modifier"),
  situation: z.enum([
    "close-set",
    "behind",
    "ahead",
    "first-match",
    "tournament",
    "serve",
    "receive",
    "attack",
    "block",
  ]),
  value: z.number().int().min(-50).max(50),
});

export const traitEffectSchema = z.discriminatedUnion("type", [
  abilityModifierEffectSchema,
  situationModifierEffectSchema,
]);

export const traitDefinitionSchema = z.object({
  id: dataIdSchema,
  name: z.string().trim().min(1).max(24),
  description: z.string().trim().min(1).max(180),
  category: z.enum([
    "offense",
    "defense",
    "serve",
    "block",
    "mental",
    "leadership",
    "weakness",
  ]),
  polarity: z.enum(["positive", "negative", "mixed"]),
  rarity: z.number().int().min(1).max(100),
  effects: z.array(traitEffectSchema).min(1).max(6),
  tags: z.array(z.string().trim().min(1).max(30)).max(8),
});

export const trainingMenuDefinitionSchema = z.object({
  id: dataIdSchema,
  name: z.string().trim().min(1).max(30),
  description: z.string().trim().min(1).max(180),
  targetAbilities: z.array(abilityKeySchema).min(1).max(5),
  baseGrowth: z.number().int().min(1).max(20),
  fatigue: z.number().int().min(-30).max(50),
  injuryRisk: z.number().int().min(0).max(100),
  relationshipGrowth: z.number().int().min(-10).max(20),
  tags: z.array(z.string().trim().min(1).max(30)).max(8),
});

export const individualTrainingInstructionDefinitionSchema = z.object({
  id: dataIdSchema,
  name: z.string().trim().min(1).max(30),
  description: z.string().trim().min(1).max(180),
  targetAbilities: z.array(abilityKeySchema).min(1).max(3),
  baseGrowth: z.number().int().min(1).max(12),
  fatigue: z.number().int().min(0).max(20),
  injuryRisk: z.number().int().min(0).max(50),
  trustGrowth: z.number().int().min(-10).max(20),
  tags: z.array(z.string().trim().min(1).max(30)).max(8),
});

export const schoolArchetypeDefinitionSchema = z.object({
  id: dataIdSchema,
  name: z.string().trim().min(1).max(30),
  description: z.string().trim().min(1).max(180),
  trainingPriorities: z.array(abilityKeySchema).min(2).max(5),
  attackTempo: z.enum(["slow", "balanced", "fast"]),
  blockSystem: z.enum(["read", "commit", "mixed"]),
  recruitmentHeightBias: z.number().int().min(-20).max(20),
  recruitmentSkillBias: z.number().int().min(-20).max(20),
  preferredTraitIds: z.array(dataIdSchema).max(8),
});

const activityTypeSchema = z.enum([
  "practice",
  "exam",
  "camp",
  "practice-match",
  "qualifier",
  "prefectural-tournament",
  "national-tournament",
  "graduation",
  "intake",
  "recovery",
]);

const numericRangeSchema = z.object({
  min: z.number().int().min(0).max(100).optional(),
  max: z.number().int().min(0).max(100).optional(),
});

export const eventTriggerSchema = z.object({
  months: z.array(z.number().int().min(1).max(12)).max(12).optional(),
  minGrade: z.number().int().min(1).max(3).optional(),
  maxGrade: z.number().int().min(1).max(3).optional(),
  requiredTraitIds: z.array(dataIdSchema).max(6).optional(),
  excludedTraitIds: z.array(dataIdSchema).max(6).optional(),
  abilityRanges: z.record(abilityKeySchema, numericRangeSchema).optional(),
  morale: numericRangeSchema.optional(),
  fatigue: numericRangeSchema.optional(),
  trust: numericRangeSchema.optional(),
  academic: numericRangeSchema.optional(),
  relationship: numericRangeSchema.optional(),
  injuryState: z.enum(["healthy", "injured"]).optional(),
  schoolReputationMin: z.number().int().min(0).max(1000).optional(),
  schoolReputationMax: z.number().int().min(0).max(1000).optional(),
  schoolFundsMin: z.number().int().min(0).max(1_000_000).optional(),
  schoolFundsMax: z.number().int().min(0).max(1_000_000).optional(),
  recordKey: z.string().trim().min(1).max(80).optional(),
  recordMin: z.number().int().min(0).max(1_000_000).optional(),
  recentMatchResult: z.enum(["win", "loss"]).optional(),
  tournamentStages: z.array(activityTypeSchema).max(10).optional(),
  tournamentOnly: z.boolean().optional(),
});

const facilityKeySchema = z.enum([
  "gym",
  "trainingRoom",
  "analysisRoom",
  "recoveryRoom",
  "dormitory",
  "scoutingNetwork",
  "alumniAssociation",
  "studyRoom",
]);

export const eventEffectSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ability-change"),
    ability: abilityKeySchema,
    amount: z.number().int().min(-20).max(20),
  }),
  z.object({
    type: z.literal("morale-change"),
    amount: z.number().int().min(-50).max(50),
  }),
  z.object({
    type: z.literal("fatigue-change"),
    amount: z.number().int().min(-50).max(50),
  }),
  z.object({
    type: z.literal("trust-change"),
    amount: z.number().int().min(-50).max(50),
  }),
  z.object({
    type: z.literal("relationship-change"),
    amount: z.number().int().min(-50).max(50),
  }),
  z.object({
    type: z.literal("reputation-change"),
    amount: z.number().int().min(-100).max(100),
  }),
  z.object({
    type: z.literal("funds-change"),
    amount: z.number().int().min(-100_000).max(100_000),
  }),
  z.object({
    type: z.literal("facility-change"),
    facility: facilityKeySchema,
    amount: z.number().int().min(-5).max(5),
  }),
  z.object({
    type: z.literal("injury-set"),
    severity: z.enum(["minor", "moderate", "severe"]),
    weeks: z.number().int().min(1).max(52),
    recurrenceRisk: z.number().int().min(0).max(100),
  }),
  z.object({ type: z.literal("injury-clear") }),
  z.object({
    type: z.literal("add-trait"),
    traitId: dataIdSchema,
  }),
  z.object({
    type: z.literal("remove-trait"),
    traitId: dataIdSchema,
  }),
  z.object({
    type: z.literal("schedule-event"),
    eventId: dataIdSchema,
    afterWeeks: z.number().int().min(1).max(52),
    probability: z.number().int().min(0).max(100),
  }),
]);

export const eventFollowUpSchema = z.object({
  eventId: dataIdSchema,
  afterWeeks: z.number().int().min(1).max(52),
  probability: z.number().int().min(0).max(100),
});

export const eventChoiceSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().trim().min(1).max(80),
  detail: z.string().trim().min(1).max(180),
  effects: z.array(eventEffectSchema).min(1).max(8),
  followUp: eventFollowUpSchema.optional(),
});

export const eventDefinitionSchema = z.object({
  id: dataIdSchema,
  version: z.literal(1),
  category: z.enum([
    "individual",
    "relationship",
    "practice",
    "injury",
    "academic",
    "match",
    "captaincy",
    "scouting",
    "rivalry",
    "ob",
    "rare",
    "seasonal",
  ]),
  title: z.string().trim().min(1).max(80),
  bodyTemplate: z.string().trim().min(1).max(500),
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
  trigger: eventTriggerSchema,
  weight: z.number().int().min(1).max(1000),
  cooldownWeeks: z.number().int().min(0).max(260),
  oncePerCareer: z.boolean(),
  actorCount: z.number().int().min(1).max(4),
  choices: z.array(eventChoiceSchema).min(2).max(4),
});

export const rawGameDataSchema = z.object({
  names: nameCatalogSchema,
  personalities: z.array(personalityDefinitionSchema).min(1),
  growthTypes: z.array(growthTypeDefinitionSchema).min(1),
  traits: z.array(traitDefinitionSchema).min(1),
  trainingMenus: z.array(trainingMenuDefinitionSchema).min(1),
  individualTrainingInstructions: z
    .array(individualTrainingInstructionDefinitionSchema)
    .min(1)
    .optional(),
  schoolArchetypes: z.array(schoolArchetypeDefinitionSchema).min(1),
  events: z.array(eventDefinitionSchema).min(1),
});

export type AbilityKey = z.infer<typeof abilityKeySchema>;
export type NameEntry = z.infer<typeof nameEntrySchema>;
export type PersonalityDefinition = z.infer<typeof personalityDefinitionSchema>;
export type GrowthTypeDefinition = z.infer<typeof growthTypeDefinitionSchema>;
export type TraitDefinition = z.infer<typeof traitDefinitionSchema>;
export type TrainingMenuDefinition = z.infer<
  typeof trainingMenuDefinitionSchema
>;
export type IndividualTrainingInstructionDefinition = z.infer<
  typeof individualTrainingInstructionDefinitionSchema
>;
export type SchoolArchetypeDefinition = z.infer<
  typeof schoolArchetypeDefinitionSchema
>;
export type EventTrigger = z.infer<typeof eventTriggerSchema>;
export type EventEffect = z.infer<typeof eventEffectSchema>;
export type EventChoiceDefinition = z.infer<typeof eventChoiceSchema>;
export type EventDefinition = z.infer<typeof eventDefinitionSchema>;
export type RawGameData = z.infer<typeof rawGameDataSchema>;
