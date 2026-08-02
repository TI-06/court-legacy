import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { GameDataErrorScreen } from "./app/GameDataErrorScreen";
import "./app.css";
import "./features/home/home-week.css";
import "./mobile-layout.css";
import "./ui/theme/game-theme.css";
import { gameDataBootstrap } from "./data/gameData";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Application root element was not found");
}

createRoot(rootElement).render(
  <StrictMode>
    {gameDataBootstrap.ok ? (
      <App />
    ) : (
      <GameDataErrorScreen message={gameDataBootstrap.message} />
    )}
  </StrictMode>,
);
