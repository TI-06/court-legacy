import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CloudGameSnapshot } from "../../worker/data/GameStore";
import { LoginScreen } from "../features/auth/LoginScreen";
import { SchoolSetupScreen } from "../features/onboarding/SchoolSetupScreen";
import type { AuthClient, AuthSession } from "../services/auth/AuthClient";
import {
  ApiError,
  type GameApiClient,
  type OnboardingInput,
} from "../services/api/GameApiClient";

export type AppBootstrapStatus =
  | "checking-auth"
  | "signed-out"
  | "loading-cloud"
  | "needs-onboarding"
  | "ready"
  | "offline-cache"
  | "fatal-error";

export interface AppBootstrapGameProps {
  game: CloudGameSnapshot;
  session: AuthSession;
  auth: AuthClient;
  api: GameApiClient;
}

interface AppBootstrapProps {
  auth: AuthClient;
  api: GameApiClient;
  renderGame(props: AppBootstrapGameProps): ReactNode;
}

type BootstrapViewState =
  | { status: "checking-auth" }
  | { status: "signed-out" }
  | { status: "loading-cloud"; session: AuthSession }
  | { status: "needs-onboarding"; session: AuthSession }
  | { status: "ready"; session: AuthSession; game: CloudGameSnapshot }
  | { status: "offline-cache"; session: AuthSession; message: string }
  | { status: "fatal-error"; session: AuthSession | null; message: string };

export function AppBootstrap({ auth, api, renderGame }: AppBootstrapProps) {
  const [view, setView] = useState<BootstrapViewState>({
    status: "checking-auth",
  });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    let authRevision = 0;

    const loadCloud = async (session: AuthSession) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setView({ status: "loading-cloud", session });
      try {
        const response = await api.bootstrap(
          session.accessToken,
          controller.signal,
        );
        if (!active || controller.signal.aborted) return;
        setView(
          response.status === "ready"
            ? { status: "ready", session, game: response.game }
            : { status: "needs-onboarding", session },
        );
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        if (error instanceof ApiError && error.code === "network_error") {
          setView({
            status: "offline-cache",
            session,
            message: "クラウドに接続できませんでした",
          });
          return;
        }
        setView({
          status: "fatal-error",
          session,
          message:
            error instanceof ApiError
              ? error.message
              : "学校データを読み込めませんでした",
        });
      }
    };

    const applySession = (session: AuthSession | null) => {
      controllerRef.current?.abort();
      if (!session) {
        setView({ status: "signed-out" });
        return;
      }
      void loadCloud(session);
    };

    const unsubscribe = auth.subscribe((session) => {
      authRevision += 1;
      applySession(session);
    });

    void auth
      .getSession()
      .then((session) => {
        if (active && authRevision === 0) applySession(session);
      })
      .catch((error) => {
        if (active && authRevision === 0)
          setView({
            status: "fatal-error",
            session: null,
            message:
              error instanceof Error
                ? error.message
                : "アカウントを確認できませんでした",
          });
      });

    return () => {
      active = false;
      controllerRef.current?.abort();
      unsubscribe();
    };
  }, [api, auth]);

  const onboard = async (input: OnboardingInput) => {
    if (view.status !== "needs-onboarding")
      throw new Error("onboarding is not available");
    const response = await api.onboard(view.session.accessToken, input);
    setView({ status: "ready", session: view.session, game: response.game });
  };

  if (view.status === "checking-auth")
    return (
      <div className="app-bootstrap-status" role="status">
        アカウントを確認しています…
      </div>
    );
  if (view.status === "signed-out") return <LoginScreen authClient={auth} />;
  if (view.status === "loading-cloud")
    return (
      <div className="app-bootstrap-status" role="status">
        学校データを読み込んでいます…
      </div>
    );
  if (view.status === "needs-onboarding")
    return <SchoolSetupScreen onSubmit={onboard} />;
  if (view.status === "ready")
    return (
      <>{renderGame({ game: view.game, session: view.session, auth, api })}</>
    );

  const retry = () => {
    if (view.session) {
      const session = view.session;
      setView({ status: "loading-cloud", session });
      const controller = new AbortController();
      controllerRef.current?.abort();
      controllerRef.current = controller;
      void api
        .bootstrap(session.accessToken, controller.signal)
        .then((response) => {
          if (controller.signal.aborted) return;
          setView(
            response.status === "ready"
              ? { status: "ready", session, game: response.game }
              : { status: "needs-onboarding", session },
          );
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setView({
              status: "offline-cache",
              session,
              message: "クラウドに接続できませんでした",
            });
        });
    }
  };

  return (
    <main className="app-bootstrap-error">
      <section>
        <h1>ゲームを開始できません</h1>
        <p>{view.message}</p>
        {view.session ? (
          <button onClick={retry} type="button">
            再試行
          </button>
        ) : (
          <button onClick={() => globalThis.location.reload()} type="button">
            再読み込み
          </button>
        )}
      </section>
    </main>
  );
}
