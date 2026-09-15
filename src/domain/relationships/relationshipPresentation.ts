import { relationshipKey, type GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";
import type { SpecialRelationshipKind } from "./relationshipTypes";

export type RelationshipLabel = "犬猿" | "不仲" | "普通" | "好相性" | "親友";

export interface PlayerRelationshipPresentation {
  playerId: PlayerId;
  displayName: string;
  score: number;
  label: RelationshipLabel;
  specialKinds: SpecialRelationshipKind[];
  mentorDirection: "mentor" | "protege" | null;
}

const specialRelationshipLabels: Record<SpecialRelationshipKind, string> = {
  rival: "ライバル",
  mentor: "師弟",
  partner: "相棒",
};

export function relationshipLabel(score: number): RelationshipLabel {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped < 20) return "犬猿";
  if (clamped < 40) return "不仲";
  if (clamped < 60) return "普通";
  if (clamped < 80) return "好相性";
  return "親友";
}

export function specialRelationshipKindLabel(
  kind: SpecialRelationshipKind,
): string {
  return specialRelationshipLabels[kind];
}

export function selectPlayerRelationships(
  state: GameState,
  playerId: PlayerId,
): PlayerRelationshipPresentation[] {
  const school = Object.values(state.schools).find((candidate) =>
    candidate.playerIds.includes(playerId),
  );
  if (!school) return [];

  return school.playerIds
    .filter((teammateId) => teammateId !== playerId)
    .map((teammateId) => {
      const teammate = state.players[teammateId];
      if (!teammate) return null;
      const key = relationshipKey(playerId, teammateId);
      const score = Math.max(
        0,
        Math.min(100, state.playerRelationships[key] ?? 50),
      );
      const bond = state.playerRelationshipBonds[key];
      const specialKinds = bond?.tags.map((tag) => tag.kind) ?? [];
      const mentorTag = bond?.tags.find((tag) => tag.kind === "mentor");
      const mentorDirection = mentorTag
        ? mentorTag.mentorPlayerId === playerId
          ? "mentor"
          : mentorTag.protegePlayerId === playerId
            ? "protege"
            : null
        : null;

      return {
        playerId: teammateId,
        displayName: `${teammate.lastName} ${teammate.firstName}`,
        score,
        label: relationshipLabel(score),
        specialKinds,
        mentorDirection,
      } satisfies PlayerRelationshipPresentation;
    })
    .filter((row): row is PlayerRelationshipPresentation => row !== null)
    .sort((left, right) => {
      const leftTagged = left.specialKinds.length > 0;
      const rightTagged = right.specialKinds.length > 0;
      if (leftTagged !== rightTagged) return leftTagged ? -1 : 1;

      const distanceDifference =
        Math.abs(right.score - 50) - Math.abs(left.score - 50);
      if (distanceDifference !== 0) return distanceDifference;
      return left.playerId.localeCompare(right.playerId);
    });
}
