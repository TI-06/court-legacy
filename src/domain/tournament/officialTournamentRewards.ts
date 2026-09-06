import type { TournamentLevel, TournamentRound } from "./tournamentTypes";

export interface OfficialTournamentFundReward {
  code: string;
  amount: number;
  label: string;
}

export function officialTournamentFundRewards(input: {
  level: TournamentLevel;
  round: TournamentRound;
  won: boolean;
}): OfficialTournamentFundReward[] {
  const rewards: OfficialTournamentFundReward[] = [];

  if (input.level === "prefectural") {
    if (input.won) {
      rewards.push({ code: "win", amount: 25, label: "県大会勝利" });
    }
    if (input.round === "round-of-16" && input.won) {
      rewards.push({ code: "best-8", amount: 50, label: "県大会ベスト8" });
    }
    if (input.round === "quarterfinal" && input.won) {
      rewards.push({ code: "best-4", amount: 80, label: "県大会ベスト4" });
    }
    if (input.round === "final" && !input.won) {
      rewards.push({ code: "runner-up", amount: 120, label: "県大会準優勝" });
    }
    if (input.round === "final" && input.won) {
      rewards.push({ code: "champion", amount: 250, label: "県大会優勝" });
      rewards.push({
        code: "national-qualification",
        amount: 250,
        label: "全国大会出場",
      });
      rewards.push({
        code: "national-best-16",
        amount: 100,
        label: "全国大会ベスト16",
      });
    }
    return rewards;
  }

  if (input.won) {
    rewards.push({ code: "win", amount: 60, label: "全国大会勝利" });
  }
  if (input.round === "round-of-16" && input.won) {
    rewards.push({ code: "best-8", amount: 200, label: "全国大会ベスト8" });
  }
  if (input.round === "quarterfinal" && input.won) {
    rewards.push({ code: "best-4", amount: 350, label: "全国大会ベスト4" });
  }
  if (input.round === "final" && !input.won) {
    rewards.push({ code: "runner-up", amount: 600, label: "全国大会準優勝" });
  }
  if (input.round === "final" && input.won) {
    rewards.push({ code: "champion", amount: 1000, label: "全国大会優勝" });
  }
  return rewards;
}
