from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"expected exactly one match in {path}: {old!r}, got {count}"
        )
    target.write_text(text.replace(old, new, 1))


relationship_dir = Path("src/domain/relationships")
relationship_dir.mkdir(parents=True, exist_ok=True)

(relationship_dir / "relationshipTypes.ts").write_text(
    '''import type { EventId, GameDate, PlayerId } from "../model/identifiers";

export type SpecialRelationshipKind = "rival" | "mentor" | "partner";

export interface SpecialRelationshipTag {
  kind: SpecialRelationshipKind;
  establishedDate: GameDate;
  sourceEventId: EventId | null;
  lastReinforcedDate: GameDate;
  belowThresholdSince: GameDate | null;
  mentorPlayerId?: PlayerId;
  protegePlayerId?: PlayerId;
}

export interface PlayerRelationshipBond {
  playerIds: [PlayerId, PlayerId];
  tags: SpecialRelationshipTag[];
}

export interface RelationshipLegacyRecord {
  playerIds: [PlayerId, PlayerId];
  displayNames: [string, string];
  tags: SpecialRelationshipTag[];
  finalRelationshipScore: number;
  archivedDate: GameDate;
}

export interface SpecialRelationshipTransition {
  action: "established" | "removed";
  kind: SpecialRelationshipKind;
  playerIds: [PlayerId, PlayerId];
}
'''
)

(relationship_dir / "relationshipPresentation.ts").write_text(
    '''export type RelationshipLabel =
  | "犬猿"
  | "不仲"
  | "普通"
  | "好相性"
  | "親友";

export function relationshipLabel(score: number): RelationshipLabel {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped < 20) return "犬猿";
  if (clamped < 40) return "不仲";
  if (clamped < 60) return "普通";
  if (clamped < 80) return "好相性";
  return "親友";
}
'''
)

(relationship_dir / "specialRelationships.ts").write_text(
    '''import { relationshipKey } from "../model/GameState";
import type { EventId, GameDate, PlayerId } from "../model/identifiers";
import type {
  PlayerRelationshipBond,
  SpecialRelationshipKind,
  SpecialRelationshipTag,
  SpecialRelationshipTransition,
} from "./relationshipTypes";

interface RelationshipStateLike {
  playerRelationshipBonds: Record<string, PlayerRelationshipBond>;
}

interface AddSpecialRelationshipInput {
  left: PlayerId;
  right: PlayerId;
  kind: SpecialRelationshipKind;
  gameDate: GameDate;
  sourceEventId?: EventId | null;
  mentorPlayerId?: PlayerId;
  protegePlayerId?: PlayerId;
}

interface RemoveSpecialRelationshipInput {
  left: PlayerId;
  right: PlayerId;
  kind: SpecialRelationshipKind;
}

function canonicalPair(left: PlayerId, right: PlayerId): [PlayerId, PlayerId] {
  if (left === right) {
    throw new Error("special relationship requires different players");
  }
  return left < right ? [left, right] : [right, left];
}

function validateMentorDirection(
  pair: readonly [PlayerId, PlayerId],
  input: AddSpecialRelationshipInput,
): void {
  if (input.kind !== "mentor") return;
  if (!input.mentorPlayerId || !input.protegePlayerId) {
    throw new Error("mentor relationship requires mentor and protege players");
  }
  if (input.mentorPlayerId === input.protegePlayerId) {
    throw new Error("mentor and protege must be different players");
  }
  const pairIds = new Set(pair);
  if (!pairIds.has(input.mentorPlayerId) || !pairIds.has(input.protegePlayerId)) {
    throw new Error("mentor and protege must belong to the relationship pair");
  }
}

function replaceBond<T extends RelationshipStateLike>(
  state: T,
  key: string,
  bond: PlayerRelationshipBond | null,
): T {
  const nextBonds = { ...state.playerRelationshipBonds };
  if (bond) nextBonds[key] = bond;
  else delete nextBonds[key];
  return { ...state, playerRelationshipBonds: nextBonds };
}

export function getRelationshipBond(
  state: RelationshipStateLike,
  left: PlayerId,
  right: PlayerId,
): PlayerRelationshipBond | null {
  if (left === right) return null;
  return state.playerRelationshipBonds[relationshipKey(left, right)] ?? null;
}

export function addSpecialRelationship<T extends RelationshipStateLike>(
  state: T,
  input: AddSpecialRelationshipInput,
): { state: T; transition: SpecialRelationshipTransition | null } {
  const pair = canonicalPair(input.left, input.right);
  validateMentorDirection(pair, input);
  const key = relationshipKey(...pair);
  const existing = state.playerRelationshipBonds[key] ?? {
    playerIds: pair,
    tags: [],
  };
  const existingIndex = existing.tags.findIndex((tag) => tag.kind === input.kind);

  if (existingIndex >= 0) {
    const tags = existing.tags.map((tag, index) =>
      index === existingIndex
        ? {
            ...tag,
            lastReinforcedDate: input.gameDate,
            belowThresholdSince: null,
            ...(input.kind === "mentor"
              ? {
                  mentorPlayerId: input.mentorPlayerId,
                  protegePlayerId: input.protegePlayerId,
                }
              : {}),
          }
        : tag,
    );
    return {
      state: replaceBond(state, key, { ...existing, playerIds: pair, tags }),
      transition: null,
    };
  }

  if (existing.tags.length >= 2) {
    throw new Error("a player pair may have at most two special relationship tags");
  }

  const tag: SpecialRelationshipTag = {
    kind: input.kind,
    establishedDate: input.gameDate,
    sourceEventId: input.sourceEventId ?? null,
    lastReinforcedDate: input.gameDate,
    belowThresholdSince: null,
    ...(input.kind === "mentor"
      ? {
          mentorPlayerId: input.mentorPlayerId,
          protegePlayerId: input.protegePlayerId,
        }
      : {}),
  };
  const nextState = replaceBond(state, key, {
    playerIds: pair,
    tags: [...existing.tags, tag],
  });
  return {
    state: nextState,
    transition: { action: "established", kind: input.kind, playerIds: pair },
  };
}

export function removeSpecialRelationship<T extends RelationshipStateLike>(
  state: T,
  input: RemoveSpecialRelationshipInput,
): { state: T; transition: SpecialRelationshipTransition | null } {
  const pair = canonicalPair(input.left, input.right);
  const key = relationshipKey(...pair);
  const existing = state.playerRelationshipBonds[key];
  if (!existing || !existing.tags.some((tag) => tag.kind === input.kind)) {
    return { state, transition: null };
  }
  const tags = existing.tags.filter((tag) => tag.kind !== input.kind);
  return {
    state: replaceBond(
      state,
      key,
      tags.length > 0 ? { ...existing, playerIds: pair, tags } : null,
    ),
    transition: { action: "removed", kind: input.kind, playerIds: pair },
  };
}
'''
)

replace_once(
    "src/domain/model/GameState.ts",
    'import type { TeamDynamicsState } from "../dynamics/teamDynamicsTypes";\n',
    'import type { TeamDynamicsState } from "../dynamics/teamDynamicsTypes";\nimport type {\n  PlayerRelationshipBond,\n  RelationshipLegacyRecord,\n} from "../relationships/relationshipTypes";\n',
)
replace_once(
    "src/domain/model/GameState.ts",
    "  playerDevelopmentWeeks: PlayerDevelopmentWeek[];\n",
    "  playerDevelopmentWeeks: PlayerDevelopmentWeek[];\n  relationshipLegacyHistory: RelationshipLegacyRecord[];\n",
)
replace_once(
    "src/domain/model/GameState.ts",
    "  playerRelationships: Record<string, number>;\n",
    "  playerRelationships: Record<string, number>;\n  playerRelationshipBonds: Record<string, PlayerRelationshipBond>;\n",
)
replace_once(
    "src/domain/model/GameState.ts",
    "export const CURRENT_GAME_SCHEMA_VERSION = 8;\n",
    "export const CURRENT_GAME_SCHEMA_VERSION = 9;\n",
)
replace_once(
    "src/domain/model/GameState.ts",
    "    playerDevelopmentWeeks: [],\n",
    "    playerDevelopmentWeeks: [],\n    relationshipLegacyHistory: [],\n",
)
replace_once(
    "src/domain/model/Player.ts",
    "  hiddenTraitIds: string[];\n",
    "  hiddenTraitIds: string[];\n  revealedHiddenTraitIds: string[];\n  hiddenTraitAssignmentInitialized: boolean;\n",
)
replace_once(
    "src/domain/model/Event.ts",
    "  recentPrimaryActorPlayerIds: PlayerId[];\n",
    "  recentPrimaryActorPlayerIds: PlayerId[];\n  recentActorPairKeys: string[];\n",
)
replace_once(
    "src/domain/generation/generatePlayer.ts",
    "    hiddenTraitIds: [],\n",
    "    hiddenTraitIds: [],\n    revealedHiddenTraitIds: [],\n    hiddenTraitAssignmentInitialized: false,\n",
)
replace_once(
    "src/domain/generation/generateWorld.ts",
    "    recentPrimaryActorPlayerIds: [],\n",
    "    recentPrimaryActorPlayerIds: [],\n    recentActorPairKeys: [],\n",
)
replace_once(
    "src/domain/generation/generateWorld.ts",
    "    playerRelationships,\n",
    "    playerRelationships,\n    playerRelationshipBonds: {},\n",
)
