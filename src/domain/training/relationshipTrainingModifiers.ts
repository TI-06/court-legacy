import type { GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";

export type SocialGrowthContributionCode =
  "relationship-partner" | "relationship-mentor" | "relationship-rival";

export interface SocialGrowthContribution {
  code: SocialGrowthContributionCode;
  label: string;
  percentPoints: 3 | 4;
  relatedPlayerId: PlayerId;
}

export interface RelationshipTrainingModifierSummary {
  contributions: SocialGrowthContribution[];
  rawPercentPoints: number;
  appliedPercentPoints: number;
  capped: boolean;
}

const EMPTY_SUMMARY: RelationshipTrainingModifierSummary = {
  contributions: [],
  rawPercentPoints: 0,
  appliedPercentPoints: 0,
  capped: false,
};

export function calculateRelationshipTrainingModifier(
  state: GameState,
  playerId: PlayerId,
  activeTrainingPlayerIds: ReadonlySet<PlayerId>,
): RelationshipTrainingModifierSummary {
  if (!activeTrainingPlayerIds.has(playerId)) {
    return EMPTY_SUMMARY;
  }

  const contributions: SocialGrowthContribution[] = [];
  const seen = new Set<string>();

  for (const bond of Object.values(state.playerRelationshipBonds)) {
    if (!bond.playerIds.includes(playerId)) continue;
    const relatedPlayerId = bond.playerIds.find((id) => id !== playerId);
    if (!relatedPlayerId || !activeTrainingPlayerIds.has(relatedPlayerId)) {
      continue;
    }

    for (const tag of bond.tags) {
      const dedupeKey = `${tag.kind}:${relatedPlayerId}`;
      if (seen.has(dedupeKey)) continue;

      if (tag.kind === "partner") {
        seen.add(dedupeKey);
        contributions.push({
          code: "relationship-partner",
          label: "相棒",
          percentPoints: 3,
          relatedPlayerId,
        });
        continue;
      }

      if (
        tag.kind === "mentor" &&
        tag.protegePlayerId === playerId &&
        tag.mentorPlayerId === relatedPlayerId
      ) {
        seen.add(dedupeKey);
        contributions.push({
          code: "relationship-mentor",
          label: "師弟",
          percentPoints: 4,
          relatedPlayerId,
        });
        continue;
      }

      if (tag.kind === "rival") {
        const player = state.players[playerId];
        const relatedPlayer = state.players[relatedPlayerId];
        if (
          player &&
          relatedPlayer &&
          player.preferredPosition === relatedPlayer.preferredPosition
        ) {
          seen.add(dedupeKey);
          contributions.push({
            code: "relationship-rival",
            label: "ライバル",
            percentPoints: 3,
            relatedPlayerId,
          });
        }
      }
    }
  }

  contributions.sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      left.relatedPlayerId.localeCompare(right.relatedPlayerId),
  );
  const rawPercentPoints = contributions.reduce(
    (sum, contribution) => sum + contribution.percentPoints,
    0,
  );
  const appliedPercentPoints = Math.min(5, rawPercentPoints);

  return {
    contributions,
    rawPercentPoints,
    appliedPercentPoints,
    capped: rawPercentPoints > appliedPercentPoints,
  };
}
