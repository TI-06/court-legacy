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

const accountProfile = {
  loginId: "coach.taku",
  coachName: "高城 監督",
  schoolName: "青葉高校",
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
  overrides: Partial<AuthClient> = {},
): AuthClient {
  return {
    getSession,
    subscribe,
    signInWithCredentials: vi.fn().mockResolvedValue(undefined),
    registerAccount: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    isPasswordRecovery: vi.fn().mockReturnValue(false),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function apiClient(overrides: Partial<GameApiClient> = {}): GameApiClient {
  return {
    bootstrap: vi.fn().mockResolvedValue({ status: "needs-onboarding" }),
    getAccountProfile: vi.fn().mockResolvedValue(accountProfile),
    onboard: vi.fn(),
    applyAction: vi.fn(),
    getScoutingBoard: vi.fn(),
    commitRecruit: vi.fn(),
    ...overrides,
  };
}

function GameProbe({ game }: AppBootstrapGameProps) {
  return <div>GAME READY revision {game.revision}</div>;
}

describe("AppBootstrap", () => {
  it("shows auth checking immediately and then the ID login screen when signed out", async () => {
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
      await screen.findByRole("button", { name: "ログインする" }),
    ).toBeVisible();
    expect(screen.queryByText(/Google/)).not.toBeInTheDocument();
  });

  it("loads the private account profile before rendering onboarding", async () => {
    const bootstrap = deferred<{ status: "needs-onboarding" }>();
    const getAccountProfile = vi.fn().mockResolvedValue(accountProfile);
    const api = apiClient({
      bootstrap: vi.fn(() => bootstrap.promise),
      getAccountProfile,
    });
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
    expect(getAccountProfile).toHaveBeenCalledWith(
      "access-token",
      expect.any(AbortSignal),
    );
    expect(screen.getByText("coach.taku")).toBeVisible();
    expect(screen.getByText("高城 監督")).toBeVisible();
    expect(screen.getByText("青葉高校")).toBeVisible();
  });

  it("enters the game after onboarding with registered coach and school values", async () => {
    const readyGame = snapshot();
    const onboard = vi.fn().mockResolvedValue({ status: "ready", game: readyGame });
    const api = apiClient({
      bootstrap: vi.fn().mockResolvedValue({ status: "needs-onboarding" }),
      onboard,
    });
    render(
      <AppBootstrap
        api={api}
        auth={authClient(() => Promise.resolve(session))}
        renderGame={(props) => <GameProbe {...props} />}
      />,
    );

    await screen.findByRole("heading", { name: "学校をつくる" });
    fireEvent.change(screen.getByLabelText("略称"), {
      target: { value: "青葉VC" },
    });
    fireEvent.change(screen.getByLabelText("都道府県"), {
      target: { value: "region.chiba" },
    });
    fireEvent.click(screen.getByRole("button", { name: "学校を作成" }));

    expect(onboard).toHaveBeenCalledWith("access-token", {
      displayName: "coach.taku",
      schoolName: "青葉高校",
      schoolShortName: "青葉VC",
      coachName: "高城 監督",
      regionId: "region.chiba",
    });
    expect(await screen.findByText("GAME READY revision 1")).toBeVisible();
  });

  it("shows password reset before loading cloud data during recovery", async () => {
    const api = apiClient();
    const updatePassword = vi.fn().mockResolvedValue(undefined);
    render(
      <AppBootstrap
        api={api}
        auth={authClient(
          () => Promise.resolve(session),
          () => () => undefined,
          {
            isPasswordRecovery: vi.fn().mockReturnValue(true),
            updatePassword,
          },
        )}
        renderGame={(props) => <GameProbe {...props} />}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "新しいパスワード" }),
    ).toBeVisible();
    expect(api.bootstrap).not.toHaveBeenCalled();
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
