from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one match in {path}, got {count}: {old!r}")
    target.write_text(text.replace(old, new, 1))


path = "src/persistence/gameStateCodec.ts"

replace_once(
    path,
    '''const gameHistorySchema = z\n  .object({\n''',
    '''const specialRelationshipKindSchema = z.enum(["rival", "mentor", "partner"]);\nconst relationshipPlayerPairSchema = z.tuple([playerIdSchema, playerIdSchema]);\nconst relationshipTagBase = {\n  establishedDate: gameDateSchema,\n  sourceEventId: z.string().min(1).nullable(),\n  lastReinforcedDate: gameDateSchema,\n  belowThresholdSince: gameDateSchema.nullable(),\n};\nconst specialRelationshipTagSchema = z.discriminatedUnion("kind", [\n  z\n    .object({\n      kind: z.literal("rival"),\n      ...relationshipTagBase,\n    })\n    .strict(),\n  z\n    .object({\n      kind: z.literal("partner"),\n      ...relationshipTagBase,\n    })\n    .strict(),\n  z\n    .object({\n      kind: z.literal("mentor"),\n      ...relationshipTagBase,\n      mentorPlayerId: playerIdSchema,\n      protegePlayerId: playerIdSchema,\n    })\n    .strict(),\n]);\n\nconst playerRelationshipBondSchema = z\n  .object({\n    playerIds: relationshipPlayerPairSchema,\n    tags: z.array(specialRelationshipTagSchema).max(2),\n  })\n  .strict()\n  .superRefine((bond, context) => {\n    const [leftId, rightId] = bond.playerIds;\n    if (leftId === rightId) {\n      context.addIssue({\n        code: "custom",\n        message: "relationship pair must contain two different players",\n      });\n    }\n    if (new Set(bond.tags.map((tag) => tag.kind)).size !== bond.tags.length) {\n      context.addIssue({\n        code: "custom",\n        message: "relationship tags must have unique kinds",\n      });\n    }\n    for (const tag of bond.tags) {\n      if (tag.kind !== "mentor") continue;\n      if (\n        tag.mentorPlayerId === tag.protegePlayerId ||\n        !bond.playerIds.includes(tag.mentorPlayerId) ||\n        !bond.playerIds.includes(tag.protegePlayerId)\n      ) {\n        context.addIssue({\n          code: "custom",\n          message: "mentor direction must reference both players in the pair",\n        });\n      }\n    }\n  });\n\nconst playerRelationshipBondsSchema = z\n  .record(z.string().min(1), playerRelationshipBondSchema)\n  .superRefine((bonds, context) => {\n    for (const [key, bond] of Object.entries(bonds)) {\n      const canonicalKey = [...bond.playerIds].sort().join("::");\n      if (key !== canonicalKey) {\n        context.addIssue({\n          code: "custom",\n          message: "relationship bond key must match its canonical player pair",\n        });\n      }\n    }\n  });\n\nconst relationshipLegacyRecordSchema = z\n  .object({\n    playerIds: relationshipPlayerPairSchema,\n    displayNames: z.tuple([z.string().min(1), z.string().min(1)]),\n    tags: z.array(specialRelationshipTagSchema).max(2),\n    finalRelationshipScore: z.number().min(0).max(100),\n    archivedDate: gameDateSchema,\n  })\n  .strict()\n  .superRefine((record, context) => {\n    if (new Set(record.tags.map((tag) => tag.kind)).size !== record.tags.length) {\n      context.addIssue({\n        code: "custom",\n        message: "legacy relationship tags must have unique kinds",\n      });\n    }\n    for (const tag of record.tags) {\n      if (tag.kind !== "mentor") continue;\n      if (\n        tag.mentorPlayerId === tag.protegePlayerId ||\n        !record.playerIds.includes(tag.mentorPlayerId) ||\n        !record.playerIds.includes(tag.protegePlayerId)\n      ) {\n        context.addIssue({\n          code: "custom",\n          message: "legacy mentor direction must reference both players",\n        });\n      }\n    }\n  });\n\nconst gameHistorySchema = z\n  .object({\n''',
)

replace_once(
    path,
    '''    playerDevelopmentWeeks: z.array(playerDevelopmentWeekSchema).max(52),\n    seasonGoalSeasons: z\n''',
    '''    playerDevelopmentWeeks: z.array(playerDevelopmentWeekSchema).max(52),\n    relationshipLegacyHistory: z\n      .array(relationshipLegacyRecordSchema)\n      .max(200),\n    seasonGoalSeasons: z\n''',
)

replace_once(
    path,
    '''const gameNotificationSchema = z.discriminatedUnion("type", [\n  trainingResultNotificationSchema,\n  concernResolutionNotificationSchema,\n]);\n''',
    '''const specialRelationshipNotificationSchema = z\n  .object({\n    id: z.string().min(1),\n    type: z.literal("special-relationship"),\n    createdGameDate: gameDateSchema,\n    academicYearIndex: z.number().int().positive(),\n    weekOfYear: z.number().int().positive(),\n    readAtGameDate: gameDateSchema.nullable(),\n    payload: z\n      .object({\n        action: z.enum(["established", "removed"]),\n        kind: specialRelationshipKindSchema,\n        kindLabel: z.string().min(1),\n        playerIds: relationshipPlayerPairSchema,\n        displayNames: z.tuple([z.string().min(1), z.string().min(1)]),\n      })\n      .strict(),\n  })\n  .strict();\n\nconst gameNotificationSchema = z.discriminatedUnion("type", [\n  trainingResultNotificationSchema,\n  concernResolutionNotificationSchema,\n  specialRelationshipNotificationSchema,\n]);\n''',
)

replace_once(
    path,
    '''const gameStateSchema = z\n  .object({\n    schemaVersion: z.number().int().nonnegative(),\n''',
    '''const persistedPlayerSchema = z\n  .object({\n    hiddenTraitIds: z.array(z.string().min(1)),\n    revealedHiddenTraitIds: z.array(z.string().min(1)),\n    hiddenTraitAssignmentInitialized: z.boolean(),\n  })\n  .passthrough()\n  .superRefine((player, context) => {\n    const hidden = new Set(player.hiddenTraitIds);\n    if (player.revealedHiddenTraitIds.some((traitId) => !hidden.has(traitId))) {\n      context.addIssue({\n        code: "custom",\n        message: "revealed hidden traits must be assigned hidden traits",\n      });\n    }\n  });\n\nconst eventMemorySchema = z\n  .object({\n    recentActorPairKeys: z.array(z.string().min(1)).max(6),\n  })\n  .passthrough();\n\nconst gameStateSchema = z\n  .object({\n    schemaVersion: z.literal(CURRENT_GAME_SCHEMA_VERSION),\n''',
)

replace_once(
    path,
    '''    schools: z.record(z.string(), objectSchema),\n    players: z.record(z.string(), objectSchema),\n    playerRelationships: z.record(z.string(), z.number().min(0).max(100)),\n''',
    '''    schools: z.record(z.string(), objectSchema),\n    players: z.record(z.string(), persistedPlayerSchema),\n    playerRelationships: z.record(z.string(), z.number().min(0).max(100)),\n    playerRelationshipBonds: playerRelationshipBondsSchema,\n''',
)

replace_once(
    path,
    '''    history: gameHistorySchema,\n    eventMemory: objectSchema,\n''',
    '''    history: gameHistorySchema,\n    eventMemory: eventMemorySchema,\n''',
)

replace_once(
    path,
    '''function migrateVersionSeven(legacy: Record<string, unknown>): unknown {\n  return {\n    ...legacy,\n    schemaVersion: CURRENT_GAME_SCHEMA_VERSION,\n    history: {\n      ...historyObject(legacy.history),\n      playerDevelopmentWeeks: [],\n    },\n    teamPlanning: createDefaultTeamPlanning(),\n  };\n}\n''',
    '''function migrateVersionEight(legacy: Record<string, unknown>): unknown {\n  const legacyPlayers =\n    legacy.players && typeof legacy.players === "object" && !Array.isArray(legacy.players)\n      ? (legacy.players as Record<string, unknown>)\n      : {};\n  const players = Object.fromEntries(\n    Object.entries(legacyPlayers).map(([id, value]) => {\n      const player =\n        value && typeof value === "object" && !Array.isArray(value)\n          ? (value as Record<string, unknown>)\n          : {};\n      return [\n        id,\n        {\n          ...player,\n          revealedHiddenTraitIds: [],\n          hiddenTraitAssignmentInitialized: false,\n        },\n      ];\n    }),\n  );\n  const eventMemory =\n    legacy.eventMemory &&\n    typeof legacy.eventMemory === "object" &&\n    !Array.isArray(legacy.eventMemory)\n      ? (legacy.eventMemory as Record<string, unknown>)\n      : {};\n\n  return {\n    ...legacy,\n    schemaVersion: CURRENT_GAME_SCHEMA_VERSION,\n    players,\n    playerRelationshipBonds: {},\n    history: {\n      ...historyObject(legacy.history),\n      relationshipLegacyHistory: [],\n    },\n    eventMemory: {\n      ...eventMemory,\n      recentActorPairKeys: [],\n    },\n  };\n}\n\nfunction migrateVersionSeven(legacy: Record<string, unknown>): unknown {\n  return migrateVersionEight({\n    ...legacy,\n    schemaVersion: 8,\n    history: {\n      ...historyObject(legacy.history),\n      playerDevelopmentWeeks: [],\n    },\n    teamPlanning: createDefaultTeamPlanning(),\n  });\n}\n''',
)

replace_once(
    path,
    '''  if (version === 7) {\n    return migrateVersionSeven(legacy);\n  }\n\n  throw new Error(`未対応のセーブデータ形式です: ${String(version)}`);\n''',
    '''  if (version === 7) {\n    return migrateVersionSeven(legacy);\n  }\n  if (version === 8) {\n    return migrateVersionEight(legacy);\n  }\n\n  throw new Error(`未対応のセーブデータ形式です: ${String(version)}`);\n''',
)
