import { useMemo } from "react";
import { AppBootstrap } from "./app/AppBootstrap";
import { GameApp } from "./app/GameApp";
import type { AuthClient } from "./services/auth/AuthClient";
import { createSupabaseAuthClient } from "./services/auth/SupabaseAuthClient";
import { HttpGameApiClient, type GameApiClient } from "./services/api/GameApiClient";

interface AppProps {
  auth?: AuthClient;
  api?: GameApiClient;
}

export default function App({ auth: injectedAuth, api: injectedApi }: AppProps = {}) {
  const auth = useMemo(() => injectedAuth ?? createSupabaseAuthClient(), [injectedAuth]);
  const api = useMemo(() => injectedApi ?? new HttpGameApiClient(), [injectedApi]);

  return <AppBootstrap auth={auth} api={api} renderGame={({ game }) => <GameApp snapshot={game} />} />;
}
