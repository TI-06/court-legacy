export type AbilityRatingGrade = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type SchoolStrengthGrade = "A" | "B" | "C" | "D" | "E" | "F";

export function ratingToGrade(value: number): AbilityRatingGrade {
  const rating = Math.max(0, Math.min(100, Math.round(value)));
  if (rating >= 80) return "A";
  if (rating >= 70) return "B";
  if (rating >= 60) return "C";
  if (rating >= 50) return "D";
  if (rating >= 40) return "E";
  if (rating >= 20) return "F";
  return "G";
}

export function schoolStrengthToGrade(value: number): SchoolStrengthGrade {
  const strength = Number.isFinite(value) ? Math.round(value) : 0;
  if (strength >= 90) return "A";
  if (strength >= 80) return "B";
  if (strength >= 70) return "C";
  if (strength >= 60) return "D";
  if (strength >= 50) return "E";
  return "F";
}
