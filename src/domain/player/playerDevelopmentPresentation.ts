import type { Player, PlayerTier } from "../model/Player";

interface GrowthPresentation {
  label: string;
  description: string;
}

const growthPresentations: Record<string, GrowthPresentation> = {
  "growth.early": {
    label: "早熟",
    description: "1年時から伸びやすく、早い段階で戦力になりやすい",
  },
  "growth.standard": {
    label: "標準",
    description: "3年間を通して安定して成長する",
  },
  "growth.late": {
    label: "大器晩成",
    description: "後半ほど伸びやすく、3年時に大きく化ける可能性がある",
  },
  "growth.practice": {
    label: "努力型",
    description: "日々の練習で能力を伸ばしやすい",
  },
  "growth.match": {
    label: "実戦型",
    description: "試合経験から成長しやすい",
  },
  "growth.adversity": {
    label: "逆境型",
    description: "敗戦や控え経験を成長につなげやすい",
  },
  "growth.conversion": {
    label: "転向型",
    description: "適性を見抜いたポジション変更で伸びる可能性がある",
  },
  "growth.complete": {
    label: "完成型",
    description: "入学時から能力が高い一方、伸びしろは小さめ",
  },
};

const talentLabels: Record<PlayerTier, string> = {
  normal: "普通",
  promising: "有望",
  prospect: "期待株",
  elite: "逸材",
  generational: "天才",
  monster: "怪物",
};

function potentialGrade(value: number): string {
  if (value >= 90) return "S";
  if (value >= 80) return "A";
  if (value >= 70) return "B";
  if (value >= 60) return "C";
  if (value >= 50) return "D";
  return "E";
}

export interface PlayerDevelopmentPresentation {
  growthLabel: string;
  growthDescription: string;
  talentLabel: string;
  potential: number | null;
  potentialGrade: string | null;
}

export function getPlayerDevelopmentPresentation(
  player: Player,
): PlayerDevelopmentPresentation {
  const growth = growthPresentations[player.growthTypeId] ?? {
    label: "特殊型",
    description: "固有の成長傾向を持つ",
  };
  const potential =
    typeof player.potential === "number" ? Math.round(player.potential) : null;

  return {
    growthLabel: growth.label,
    growthDescription: growth.description,
    talentLabel: talentLabels[player.tier],
    potential,
    potentialGrade: potential === null ? null : potentialGrade(potential),
  };
}
