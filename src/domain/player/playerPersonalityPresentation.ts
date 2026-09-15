import type { PersonalityDefinition } from "../validation/gameDataSchema";

export interface PlayerPersonalityPresentation {
  name: string;
  description: string;
  trainingStability: "安定" | "標準" | "波あり";
  relationshipBuilding: "得意" | "標準" | "苦手";
  pressureResponse: "強い" | "標準" | "弱い";
  moraleVolatility: "安定" | "標準" | "揺れやすい";
}

export function getPlayerPersonalityPresentation(
  personality: PersonalityDefinition,
): PlayerPersonalityPresentation {
  return {
    name: personality.name,
    description: personality.description,
    trainingStability:
      personality.trainingStability >= 6
        ? "安定"
        : personality.trainingStability <= -6
          ? "波あり"
          : "標準",
    relationshipBuilding:
      personality.relationshipGrowth >= 6
        ? "得意"
        : personality.relationshipGrowth <= -3
          ? "苦手"
          : "標準",
    pressureResponse:
      personality.pressureModifier >= 6
        ? "強い"
        : personality.pressureModifier <= -6
          ? "弱い"
          : "標準",
    moraleVolatility:
      personality.moraleVolatility <= 35
        ? "安定"
        : personality.moraleVolatility >= 65
          ? "揺れやすい"
          : "標準",
  };
}
