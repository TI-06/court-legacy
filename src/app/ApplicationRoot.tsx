import App from "../App";
import { gameDataBootstrap } from "../data/gameData";
import { AppUpdateBanner } from "../pwa/AppUpdateBanner";
import type { GameApiClient } from "../services/api/GameApiClient";
import type { AuthClient } from "../services/auth/AuthClient";
import { GameDataErrorScreen } from "./GameDataErrorScreen";

interface ApplicationRootProps {
  auth?: AuthClient;
  api?: GameApiClient;
  updateReady?: boolean;
  onAppRefresh?: () => void;
}

const noop = () => undefined;

export function ApplicationRoot({
  auth,
  api,
  updateReady = false,
  onAppRefresh = noop,
}: ApplicationRootProps) {
  const content = gameDataBootstrap.ok ? (
    <App auth={auth} api={api} />
  ) : (
    <GameDataErrorScreen message={gameDataBootstrap.message} />
  );

  return (
    <>
      <AppUpdateBanner updateReady={updateReady} onRefresh={onAppRefresh} />
      {content}
    </>
  );
}
