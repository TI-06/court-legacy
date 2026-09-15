from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one match in {path}, got {count}: {old!r}")
    target.write_text(text.replace(old, new, 1))


# Schema: pair-aware triggers and explicit special-relationship effects.
replace_once(
    "src/domain/validation/gameDataSchema.ts",
    "  relationship: numericRangeSchema.optional(),\n  injuryState: z.enum([\"healthy\", \"injured\"]).optional(),\n",
    "  relationship: numericRangeSchema.optional(),\n  samePreferredPosition: z.boolean().optional(),\n  differentGrades: z.boolean().optional(),\n  injuryState: z.enum([\"healthy\", \"injured\"]).optional(),\n",
)
replace_once(
    "src/domain/validation/gameDataSchema.ts",
    "export const eventEffectSchema = z.discriminatedUnion(\"type\", [\n",
    "const specialRelationshipKindSchema = z.enum([\"rival\", \"mentor\", \"partner\"]);\n\nexport const eventEffectSchema = z.discriminatedUnion(\"type\", [\n",
)
replace_once(
    "src/domain/validation/gameDataSchema.ts",
    '''  z.object({
    type: z.literal("relationship-change"),
    amount: z.number().int().min(-50).max(50),
  }),
  z.object({
    type: z.literal("reputation-change"),
''',
    '''  z.object({
    type: z.literal("relationship-change"),
    amount: z.number().int().min(-50).max(50),
  }),
  z.object({
    type: z.literal("special-relationship-add"),
    kind: specialRelationshipKindSchema,
    mentor: z.enum(["higher-grade", "actor-0", "actor-1"]).optional(),
  }),
  z.object({
    type: z.literal("special-relationship-remove"),
    kind: specialRelationshipKindSchema,
  }),
  z.object({
    type: z.literal("reputation-change"),
''',
)

# Eligibility: first pair can be constrained by position and grade relation.
replace_once(
    "src/domain/events/eventEligibility.ts",
    '''  if (
    !actors.every((actor) => playerMatchesTrigger(actor as Player, trigger))
  ) {
    return false;
  }
  if (trigger.relationship && actorPlayerIds.length >= 2) {
''',
    '''  if (
    !actors.every((actor) => playerMatchesTrigger(actor as Player, trigger))
  ) {
    return false;
  }
  if (actorPlayerIds.length >= 2) {
    const [leftActor, rightActor] = actors as [Player, Player, ...Player[]];
    if (
      trigger.samePreferredPosition !== undefined &&
      (leftActor.preferredPosition === rightActor.preferredPosition) !==
        trigger.samePreferredPosition
    ) {
      return false;
    }
    if (
      trigger.differentGrades !== undefined &&
      (leftActor.grade !== rightActor.grade) !== trigger.differentGrades
    ) {
      return false;
    }
  }
  if (trigger.relationship && actorPlayerIds.length >= 2) {
''',
)

# Resolver imports.
replace_once(
    "src/domain/events/resolveEventChoice.ts",
    'import { addWeeks } from "./eventDate";\n',
    'import { addWeeks } from "./eventDate";\nimport { relationshipLabel } from "../relationships/relationshipPresentation";\nimport {\n  addSpecialRelationship,\n  removeSpecialRelationship,\n} from "../relationships/specialRelationships";\nimport type {\n  SpecialRelationshipKind,\n  SpecialRelationshipTransition,\n} from "../relationships/relationshipTypes";\n',
)
replace_once(
    "src/domain/events/resolveEventChoice.ts",
    '''function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}
''',
    '''function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function specialRelationshipLabel(kind: SpecialRelationshipKind): string {
  return kind === "rival" ? "ライバル" : kind === "mentor" ? "師弟" : "相棒";
}
''',
)
replace_once(
    "src/domain/events/resolveEventChoice.ts",
    '''  visibleResult: string;
  followUp?: ScheduledEventFollowUp;
} {
''',
    '''  visibleResult: string;
  followUp?: ScheduledEventFollowUp;
  specialRelationshipTransition?: SpecialRelationshipTransition;
} {
''',
)
replace_once(
    "src/domain/events/resolveEventChoice.ts",
    '''    case "relationship-change": {
      const [left, right] = actorPlayerIds;
      if (!left || !right) {
        return { state, visibleResult: "関係変化なし" };
      }
      const key = relationshipKey(left, right);
      const current = state.playerRelationships[key] ?? 50;
      return {
        state: {
          ...state,
          playerRelationships: {
            ...state.playerRelationships,
            [key]: clamp(current + effect.amount, 0, 100),
          },
        },
        visibleResult: `連携 ${signed(effect.amount)}`,
      };
    }
    case "reputation-change": {
''',
    '''    case "relationship-change": {
      const [left, right] = actorPlayerIds;
      if (!left || !right) {
        return { state, visibleResult: "関係変化なし" };
      }
      const key = relationshipKey(left, right);
      const current = state.playerRelationships[key] ?? 50;
      const next = clamp(current + effect.amount, 0, 100);
      const beforeLabel = relationshipLabel(current);
      const afterLabel = relationshipLabel(next);
      return {
        state: {
          ...state,
          playerRelationships: {
            ...state.playerRelationships,
            [key]: next,
          },
        },
        visibleResult:
          beforeLabel === afterLabel
            ? `連携 ${signed(effect.amount)}`
            : `連携 ${signed(effect.amount)}（${beforeLabel} → ${afterLabel}）`,
      };
    }
    case "special-relationship-add": {
      const [left, right] = actorPlayerIds;
      if (!left || !right) {
        return { state, visibleResult: "特殊関係変化なし" };
      }
      let mentorPlayerId: PlayerId | undefined;
      let protegePlayerId: PlayerId | undefined;
      if (effect.kind === "mentor") {
        const mentorMode = effect.mentor;
        if (!mentorMode) {
          throw new Error("mentor special relationship requires mentor direction");
        }
        if (mentorMode === "actor-0") {
          mentorPlayerId = left;
          protegePlayerId = right;
        } else if (mentorMode === "actor-1") {
          mentorPlayerId = right;
          protegePlayerId = left;
        } else {
          const leftPlayer = state.players[left];
          const rightPlayer = state.players[right];
          if (!leftPlayer || !rightPlayer || leftPlayer.grade === rightPlayer.grade) {
            throw new Error("higher-grade mentor requires actors from different grades");
          }
          if (leftPlayer.grade > rightPlayer.grade) {
            mentorPlayerId = left;
            protegePlayerId = right;
          } else {
            mentorPlayerId = right;
            protegePlayerId = left;
          }
        }
      }
      const added = addSpecialRelationship(state, {
        playerIds: [left, right],
        kind: effect.kind,
        establishedDate: state.date,
        sourceEventId: eventId(event.id),
        ...(mentorPlayerId && protegePlayerId
          ? { mentorPlayerId, protegePlayerId }
          : {}),
      });
      return {
        state: added.state,
        visibleResult: `特殊関係 ${specialRelationshipLabel(effect.kind)}${
          added.transition ? "成立" : "継続"
        }`,
        ...(added.transition
          ? { specialRelationshipTransition: added.transition }
          : {}),
      };
    }
    case "special-relationship-remove": {
      const [left, right] = actorPlayerIds;
      if (!left || !right) {
        return { state, visibleResult: "特殊関係変化なし" };
      }
      const removed = removeSpecialRelationship(state, {
        playerIds: [left, right],
        kind: effect.kind,
      });
      return {
        state: removed.state,
        visibleResult: removed.transition
          ? `特殊関係 ${specialRelationshipLabel(effect.kind)}解消`
          : `特殊関係 ${specialRelationshipLabel(effect.kind)}変化なし`,
        ...(removed.transition
          ? { specialRelationshipTransition: removed.transition }
          : {}),
      };
    }
    case "reputation-change": {
''',
)
replace_once(
    "src/domain/events/resolveEventChoice.ts",
    '''export interface ResolveEventChoiceResult {
  state: GameState;
  occurrence: EventOccurrence;
}
''',
    '''export interface ResolveEventChoiceResult {
  state: GameState;
  occurrence: EventOccurrence;
  specialRelationshipTransitions: SpecialRelationshipTransition[];
}
''',
)
replace_once(
    "src/domain/events/resolveEventChoice.ts",
    '''  const visibleResultCodes: string[] = [];
  const scheduledFollowUps: ScheduledEventFollowUp[] = [];
''',
    '''  const visibleResultCodes: string[] = [];
  const scheduledFollowUps: ScheduledEventFollowUp[] = [];
  const specialRelationshipTransitions: SpecialRelationshipTransition[] = [];
''',
)
replace_once(
    "src/domain/events/resolveEventChoice.ts",
    '''    if (applied.followUp) {
      scheduledFollowUps.push(applied.followUp);
    }
''',
    '''    if (applied.followUp) {
      scheduledFollowUps.push(applied.followUp);
    }
    if (applied.specialRelationshipTransition) {
      specialRelationshipTransitions.push(applied.specialRelationshipTransition);
    }
''',
)
replace_once(
    "src/domain/events/resolveEventChoice.ts",
    "  return { state: nextState, occurrence };\n",
    "  return { state: nextState, occurrence, specialRelationshipTransitions };\n",
)
