import "./matchRadar.css";

export type TeamRatingGrade = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export function ratingToGrade(value: number): TeamRatingGrade {
  const rating = Math.max(0, Math.min(100, Math.round(value)));
  if (rating >= 80) return "A";
  if (rating >= 70) return "B";
  if (rating >= 60) return "C";
  if (rating >= 50) return "D";
  if (rating >= 40) return "E";
  if (rating >= 20) return "F";
  return "G";
}
