import type {
  AttackPlan,
  BlockPlan,
  MatchTacticPlan,
  ServePlan,
  TacticMatchupRating,
} from "../../domain/team/matchTactics";

export interface TacticOption<Value extends string> {
  value: Value;
  label: string;
  description: string;
}

export const serveTacticOptions: readonly TacticOption<ServePlan>[] = [
  {
    value: "safe",
    label: "安全重視",
    description: "ミスを抑える代わりに相手を崩しにくい",
  },
  {
    value: "balanced",
    label: "バランス",
    description: "リスクと威力の中間を狙う",
  },
  {
    value: "aggressive",
    label: "強気",
    description: "エースと崩しを狙う代わりにミスが増える",
  },
];

export const attackTacticOptions: readonly TacticOption<AttackPlan>[] = [
  {
    value: "side",
    label: "サイド重視",
    description: "OH・OPへ集めて高いボールでも押し切る",
  },
  {
    value: "balanced",
    label: "バランス",
    description: "攻撃先を散らして大きな弱点を作らない",
  },
  {
    value: "quick",
    label: "高速",
    description: "MB参加を増やしブロック完成前を狙う",
  },
];

export const blockTacticOptions: readonly TacticOption<BlockPlan>[] = [
  {
    value: "commit",
    label: "コミット",
    description: "中央と速攻を早めに決め打ちする",
  },
  {
    value: "mixed",
    label: "ミックス",
    description: "読みと決め打ちを使い分ける",
  },
  {
    value: "read",
    label: "リード",
    description: "トスを見てサイドまで組織的に追う",
  },
];

export function tacticOptionLabel(
  axis: keyof MatchTacticPlan,
  value: MatchTacticPlan[keyof MatchTacticPlan],
): string {
  const options =
    axis === "serve"
      ? serveTacticOptions
      : axis === "attack"
        ? attackTacticOptions
        : blockTacticOptions;
  return (
    options.find((option) => option.value === value)?.label ?? String(value)
  );
}

export const matchupRatingLabels: Record<TacticMatchupRating, string> = {
  favorable: "相性有利",
  neutral: "五分",
  unfavorable: "相性注意",
};
