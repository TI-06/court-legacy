import { gameDataBootstrap } from "../data/gameData";
import { FEATURED_SCHOOL_SETUPS } from "../domain/generation/featuredWorldCatalog";
import { generateWorld } from "../domain/generation/generateWorld";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

export const gameData = gameDataBootstrap.data;

export function createDemoGame() {
  const userSchool = FEATURED_SCHOOL_SETUPS[0];
  if (!userSchool) {
    throw new Error("featured school catalog must include the demo school");
  }

  return generateWorld({
    seed: "court-legacy-demo",
    data: gameData,
    userSchool: {
      name: userSchool.name,
      shortName: userSchool.shortName,
      regionId: "region.okinawa",
      coachName: userSchool.coachName,
      uniform: userSchool.uniform,
    },
  });
}
