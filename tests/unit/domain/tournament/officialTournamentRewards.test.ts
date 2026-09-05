import { describe, expect, it } from "vitest";
import { officialTournamentFundRewards } from "../../../../src/domain/tournament/officialTournamentRewards";

const total = (items: ReturnType<typeof officialTournamentFundRewards>) =>
  items.reduce((sum, item) => sum + item.amount, 0);

describe("official tournament fund rewards", () => {
  it("rewards prefectural progression", () => {
    expect(
      total(
        officialTournamentFundRewards({
          level: "prefectural",
          round: "round-of-16",
          won: true,
        }),
      ),
    ).toBe(75);
    expect(
      total(
        officialTournamentFundRewards({
          level: "prefectural",
          round: "quarterfinal",
          won: true,
        }),
      ),
    ).toBe(105);
    expect(
      total(
        officialTournamentFundRewards({
          level: "prefectural",
          round: "final",
          won: false,
        }),
      ),
    ).toBe(120);
    expect(
      total(
        officialTournamentFundRewards({
          level: "prefectural",
          round: "final",
          won: true,
        }),
      ),
    ).toBe(625);
  });

  it("rewards national progression", () => {
    expect(
      total(
        officialTournamentFundRewards({
          level: "national",
          round: "round-of-16",
          won: true,
        }),
      ),
    ).toBe(260);
    expect(
      total(
        officialTournamentFundRewards({
          level: "national",
          round: "quarterfinal",
          won: true,
        }),
      ),
    ).toBe(410);
    expect(
      total(
        officialTournamentFundRewards({
          level: "national",
          round: "final",
          won: false,
        }),
      ),
    ).toBe(600);
    expect(
      total(
        officialTournamentFundRewards({
          level: "national",
          round: "final",
          won: true,
        }),
      ),
    ).toBe(1060);
  });
});
