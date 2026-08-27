import App from "../App";
import { gameDataBootstrap } from "../data/gameData";
import type { GameApiClient } from "../services/api/GameApiClient";
import type { AuthClient } from "../services/auth/AuthClient";
import { GameDataErrorScreen } from "./GameDataErrorScreen";

interface ApplicationRootProps {
  auth?: AuthClient;
  api?: GameApiClient;
}

export function ApplicationRoot({ auth, api }: ApplicationRootProps) {
  if (!gameDataBootstrap.ok)
    return <GameDataErrorScreen message={gameDataBootstrap.message} />;
  return <App auth={auth} api={api} />;
}
