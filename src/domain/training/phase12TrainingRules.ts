import type { RandomSource } from "../random/SeededRandom";
export interface Phase12InjuryRiskInput {
  baseRisk: number;
  condition: number;
  injuryResistance: number;
  recoveryRoomLevel: number;
}
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
export function calculatePhase12InjuryRisk(
  input: Phase12InjuryRiskInput,
): number {
  if (input.baseRisk <= 0) return 0;
  const conditionPenalty = Math.max(
    0,
    (50 - clamp(input.condition, 0, 100)) / 4,
  );
  const resistanceBonus = (clamp(input.injuryResistance, 0, 100) - 50) / 5;
  const facilityBonus = Math.max(0, input.recoveryRoomLevel) * 1.5;
  return Math.round(
    clamp(
      input.baseRisk + conditionPenalty - resistanceBonus - facilityBonus,
      0,
      90,
    ),
  );
}
export function getWeeklyConditionDrift(
  random: Pick<RandomSource, "next">,
): number {
  return Math.floor(random.next() * 9) - 4;
}
