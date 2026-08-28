import { calculateEloUpdate } from "../../../../src/domain/pvp/elo";

describe("calculateEloUpdate", () => {
  it("moves equal 1000 ratings by 16 points when the challenger wins", () => {
    expect(
      calculateEloUpdate({
        challengerRating: 1000,
        defenderRating: 1000,
        challengerWon: true,
      }),
    ).toEqual({
      challengerDelta: 16,
      defenderDelta: -16,
      challengerRating: 1016,
      defenderRating: 984,
    });
  });

  it("rewards an upset more than a favorite win", () => {
    const upset = calculateEloUpdate({
      challengerRating: 800,
      defenderRating: 1200,
      challengerWon: true,
    });
    const favoriteWin = calculateEloUpdate({
      challengerRating: 1200,
      defenderRating: 800,
      challengerWon: true,
    });

    expect(upset.challengerDelta).toBeGreaterThan(favoriteWin.challengerDelta);
  });

  it("does not allow either resulting rating to become negative", () => {
    const result = calculateEloUpdate({
      challengerRating: 1,
      defenderRating: 2400,
      challengerWon: false,
    });

    expect(result.challengerRating).toBeGreaterThanOrEqual(0);
    expect(result.defenderRating).toBeGreaterThanOrEqual(0);
  });

  it("keeps raw Elo deltas zero-sum when the rating floor is not involved", () => {
    const result = calculateEloUpdate({
      challengerRating: 900,
      defenderRating: 1100,
      challengerWon: true,
    });

    expect(result.challengerDelta + result.defenderDelta).toBe(0);
  });
});
