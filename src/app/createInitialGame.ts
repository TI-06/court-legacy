import { gameDataBootstrap } from "../data/gameData";
import { generateWorld } from "../domain/generation/generateWorld";
import type { GameState } from "../domain/model/GameState";
import type { UniformColors } from "../domain/model/School";
import { createSeasonGoals } from "../domain/season/seasonGoals";

export interface InitialGameSetup {
  seed: string;
  schoolName: string;
  schoolShortName: string;
  coachName: string;
  regionId: string;
  uniform: UniformColors;
}

export function createInitialGame(input: InitialGameSetup): GameState {
  if (!gameDataBootstrap.ok) {
    throw new Error(gameDataBootstrap.message);
  }

  const state = generateWorld({
    seed: input.seed,
    data: gameDataBootstrap.data,
    userSchool: {
      name: input.schoolName,
      shortName: input.schoolShortName,
      regionId: input.regionId,
      coachName: input.coachName,
      uniform: input.uniform,
    },
  });

  return {
    ...state,
    seasonGoals: createSeasonGoals(state),
  };
}
