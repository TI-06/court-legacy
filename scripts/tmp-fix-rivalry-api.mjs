import { readFileSync, writeFileSync } from "node:fs";

const path = "src/domain/world/rivalWorldProgression.ts";
let source = readFileSync(path, "utf8");
const start = source.indexOf("export function recordMatchOutcome(");
const end = source.indexOf("\nfunction abilityAverage", start);
if (start < 0 || end < 0) {
  throw new Error("recordMatchOutcome block not found");
}

const replacement = `function applyRivalryChange(
  state: GameState,
  left: SchoolId,
  right: SchoolId,
  amount: number,
): GameState {
  if (left === right || !state.schools[left] || !state.schools[right]) {
    return state;
  }
  const key = rivalryKey(left, right);
  const rivalryScores = {
    ...state.world.rivalryScores,
    [key]: clamp(
      (state.world.rivalryScores[key] ?? 0) + amount,
      0,
      RIVALRY_SCORE_LIMIT,
    ),
  };
  const nextState = {
    ...state,
    world: {
      ...state.world,
      rivalryScores,
    },
  };
  return {
    ...nextState,
    world: {
      ...nextState.world,
      destinyRivalSchoolId: destinyRivalSchoolId(nextState, rivalryScores),
    },
  };
}

export function recordScoutingConflict(
  state: GameState,
  rivalSchoolId: SchoolId,
  intensity = 10,
): GameState {
  if (rivalSchoolId === state.userSchoolId || !state.schools[rivalSchoolId]) {
    return state;
  }
  return applyRivalryChange(
    state,
    state.userSchoolId,
    rivalSchoolId,
    clamp(intensity, 1, 30),
  );
}

export function recordMatchOutcome(
  state: GameState,
  summary: HistoricalMatchSummary,
): GameState {
  if (
    state.history.matches.some(
      (match) => match.matchId === summary.matchId,
    )
  ) {
    return state;
  }
  const rivalryState = applyRivalryChange(
    state,
    summary.homeSchoolId,
    summary.awaySchoolId,
    rivalryGain(state, summary),
  );
  const matches = [...rivalryState.history.matches, summary].slice(
    -MAX_MATCH_HISTORY,
  );
  const schools = updateOfficialRecords(rivalryState.schools, summary);
  return {
    ...rivalryState,
    schools,
    history: {
      ...rivalryState.history,
      matches,
    },
  };
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
writeFileSync(path, source);
