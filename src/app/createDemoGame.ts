import { gameDataBootstrap } from "../data/gameData";
import { createInitialGame } from "./createInitialGame";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

export const gameData = gameDataBootstrap.data;

export function createDemoGame() {
  return createInitialGame({
    seed: "court-legacy-demo",
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    regionId: "region.test",
    coachName: "高橋 監督",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });
}
