import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { AppBootstrapGameProps } from "../../../src/app/AppBootstrap";
import { AppBootstrap } from "../../../src/app/AppBootstrap";
import type {
  AuthClient,
  AuthSession,
} from "../../../src/services/auth/AuthClient";
import type { GameApiClient } from "../../../src/services/api/GameApiClient";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

const session: AuthSession = {
  userId: "user-123",
  email: "coach@example.com",
  accessToken: "access-token",
};

function snapshot() {
  const state = createInitialGame({
    seed: "bootstrap-test",
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高城 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });
  return {
    userId: session.userId,
    schoolDbId: "school-db-1",
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function authClient(
  getSession: AuthClient["getSession"],
  subscribe: AuthClient["subscribe"] = () => () => undefined,
): AuthClient {
  return {
    getSession,
    subscribe,
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signInWithEmail: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

function apiClient(overrides: Partial<GameApiClient> = {}): GameApiClient {
  return {
    bootstrap: vi.fn().mockResolvedValue({ status: "needs-onboarding" }),
    onboard: vi.fn(),
    applyAction: vi.fn(),
    ...overrides,
  };
}

function GameProbe({ game }: AppBootstrapGameProps) {
  return <div>GAME READY revision {game.revision}</div>;
}

describe("AppBootstrap", () => {
  it("shows auth checking immediately and then the login screen when signed out", async () => {
    const currentSession = deferred<AuthSession | null>();
    render(
      <AppBootstrap
        api={apiClient()}
        auth={authClient(() => currentSession.promise)}
        renderGame={(props) => <GameProbe {...props} />}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "アカウントを確認しています…",
    );

    await act(async () => currentSession.resolve(null));

    expect(
      await screen.findByRole("button", { name: "Googleで始める" }),
    ).toBeVisible();
  });

  it("shows cloud loading before rendering onboarding", async () => {
    const bootstrap = deferred<{ status: "needs-onboarding" }>();
    const api = apiClient({ bootstrap: vi.fn(() => bootstrap.promise) });
    render(
      <AppBootstrap
        api={api}
        auth={authClient(() => Promise.resolve(session))}
        renderGame={(props) => <GameProbe {...props} />}
      />,
    );

    expect(
      await screen.findByText("学校データを読み込んでいます…"),
    ).toBeVisible();

    await act(async () => bootstrap.resolve({ status: "needs-onboarding" }));

    expect(
      await screen.findByRole("heading", { name: "学校をつくる" }),
    ).toBeVisible();
  });

  it("enters the game after successful onboarding", async () => {
    const readyGame = snapshot();
    const api = apiClient({
      bootstrap: vi.fn().mockResolvedValue({ status: "needs-onboarding" }),
      onboard: vi.fn().mockResolvedValue({ status: "ready", game: readyGame }),
    });
    render(
      <AppBootstrap
        api={api}
        auth={authClient(() => Promise.resolve(session))}
        renderGame={(props) => <GameProbe {...props} />}
      />,
    );

    await screen.findByRole("heading", { name: "学校をつくる" });
    fireEvent.change(screen.getByLabelText("表示名"), {
      target: { value: "監督" },
    });
    fireEvent.change(screen.getByLabelText("学校名"), {
      target: { value: "青葉高校" },
    });
    fireEvent.change(screen.getByLabelText("略称"), {
      target: { value: "青葉" },
    });
    fireEvent.change(screen.getByLabelText("監督名"), {
      target: { value: "高城 監督" },
    });
    fireEvent.change(screen.getByLabelText("都道府県"), {
      target: { value: "region.chiba" },
    });
    fireEvent.click(screen.getByRole("button", { name: "学校を作成" }));

    expect(await screen.findByText("GAME READY revision 1")).toBeVisible();
  });

  it("aborts an obsolete cloud bootstrap when the auth session changes", async () => {
    let listener: ((value: AuthSession | null) => void) | undefined;
    const signals: AbortSignal[] = [];
    const bootstrap = vi.fn((_token: string, signal?: AbortSignal) => {
      if (signal) signals.push(signal);
      return new Promise<never>(() => undefined);
    });
    const auth = authClient(
      () => Promise.resolve(session),
      (next) => {
        listener = next;
        return () => undefined;
      },
    );
    render(
      <AppBootstrap
        api={apiClient({ bootstrap })}
        auth={auth}
        renderGame={(props) => <GameProbe {...props} />}
      />,
    );

    await screen.findByText("学校データを読み込んでいます…");
    expect(signals).toHaveLength(1);

    await act(async () => {
      listener?.({ ...session, accessToken: "replacement-token" });
    });

    expect(signals[0]?.aborted).toBe(true);
    expect(bootstrap).toHaveBeenCalledWith(
      "replacement-token",
      expect.any(AbortSignal),
    );
  });
});
