import App from "../App";
import type { AuthGateway } from "../auth/AuthGateway";
import { AuthGate } from "../auth/AuthGate";
import { gameDataBootstrap } from "../data/gameData";
import { GameDataErrorScreen } from "./GameDataErrorScreen";

interface ApplicationRootProps {
  authGateway: AuthGateway;
}

export function ApplicationRoot({ authGateway }: ApplicationRootProps) {
  if (!gameDataBootstrap.ok) {
    return <GameDataErrorScreen message={gameDataBootstrap.message} />;
  }

  return <AuthGate gateway={authGateway}>{() => <App />}</AuthGate>;
}
