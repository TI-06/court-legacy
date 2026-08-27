import { useMemo } from "react";
import { AppBootstrap } from "./app/AppBootstrap";
import { createBrowserAppDependencies } from "./app/createBrowserAppDependencies";
import { GameApp } from "./app/GameApp";
import type { AuthClient } from "./services/auth/AuthClient";
import type { GameApiClient } from "./services/api/GameApiClient";

interface AppProps {
  auth?: AuthClient;
  api?: GameApiClient;
}

export default function App({
  auth: injectedAuth,
  api: injectedApi,
}: AppProps = {}) {
  const dependencies = useMemo(() => {
    if (injectedAuth && injectedApi) {
      return { auth: injectedAuth, api: injectedApi };
    }

    const defaults = createBrowserAppDependencies();
    return {
      auth: injectedAuth ?? defaults.auth,
      api: injectedApi ?? defaults.api,
    };
  }, [injectedApi, injectedAuth]);

  return (
    <AppBootstrap
      auth={dependencies.auth}
      api={dependencies.api}
      renderGame={({ game }) => <GameApp snapshot={game} />}
    />
  );
}
