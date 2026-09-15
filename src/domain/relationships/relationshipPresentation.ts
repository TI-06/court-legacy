export type RelationshipLabel = "犬猿" | "不仲" | "普通" | "好相性" | "親友";

export function relationshipLabel(score: number): RelationshipLabel {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped < 20) return "犬猿";
  if (clamped < 40) return "不仲";
  if (clamped < 60) return "普通";
  if (clamped < 80) return "好相性";
  return "親友";
}
