import App from "../App";
import { AdminDashboard } from "../features/admin/AdminDashboard";
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
  // Only the query flag selects the separate application shell. Server-side
  // cookie validation always protects the administrative data and endpoints.
  if (new URLSearchParams(globalThis.location.search).get("admin") === "1") {
    return <AdminDashboard />;
  }

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
