import { gameDataBootstrap } from "../data/gameData";
import { generateWorld } from "../domain/generation/generateWorld";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

export const gameData = gameDataBootstrap.data;

export function createDemoGame() {
  return generateWorld({
    seed: "court-legacy-demo",
    data: gameData,
    userSchool: {
      name: "蒼波高校",
      shortName: "蒼波",
      regionId: "region.okinawa",
      coachName: "高城 監督",
      uniform: {
        primary: "#173B52",
        secondary: "#F4F7F8",
        accent: "#D89A2B",
      },
    },
  });
}
