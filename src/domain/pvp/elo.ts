export interface CalculateEloUpdateInput {
  challengerRating: number;
  defenderRating: number;
  challengerWon: boolean;
}

export interface EloUpdate {
  challengerDelta: number;
  defenderDelta: number;
  challengerRating: number;
  defenderRating: number;
}

const ELO_K_FACTOR = 32;
const ELO_SCALE = 400;

function expectedScore(ownRating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - ownRating) / ELO_SCALE));
}

export function calculateEloUpdate(
  input: CalculateEloUpdateInput,
): EloUpdate {
  const challengerExpected = expectedScore(
    input.challengerRating,
    input.defenderRating,
  );
  const challengerScore = input.challengerWon ? 1 : 0;
  const challengerDelta = Math.round(
    ELO_K_FACTOR * (challengerScore - challengerExpected),
  );
  const defenderDelta = -challengerDelta;

  return {
    challengerDelta,
    defenderDelta,
    challengerRating: Math.max(0, input.challengerRating + challengerDelta),
    defenderRating: Math.max(0, input.defenderRating + defenderDelta),
  };
}
