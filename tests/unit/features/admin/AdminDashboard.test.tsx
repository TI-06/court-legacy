import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminDashboard } from "../../../../src/features/admin/AdminDashboard";
import { ApplicationRoot } from "../../../../src/app/ApplicationRoot";

const overview = {
  generatedAt: "2026-10-17T00:00:00.000Z",
  accounts: { total: 27, today: 1, new7d: 6, new30d: 12 },
  games: {
    onboarded: 21,
    saveUpdated7d: 8,
    saveUpdated30d: 15,
    averageRevision: 230,
    highestRevision: 900,
    averageYear: 2.7,
    highestYear: 12,
    recordedMatches: 188,
    currentPlayers: 720,
  },
  activity: { retainedOperations: 320, operations7d: 80, operations30d: 200 },
  pvp: { matches: 14, activePublishedTeams: 5, ratedPlayers: 7 },
  shop: { purchases: 100, uses: 60, uses30d: 24 },
  regions: [{ name: "tokyo", count: 5 }],
  daily: [{ date: "2026-10-17", registrations: 2, operations: 14 }],
  topItems: [{ name: "強化合宿", count: 11 }],
};

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("AdminDashboard", () => {
  it("uses ?admin=1 to show a separate admin login, without game bootstrap", async () => {
    window.history.replaceState(null, "", "/?admin=1");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ authenticated: false }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ApplicationRoot />);
    expect(
      await screen.findByRole("heading", { name: "管理画面" }),
    ).toBeVisible();
    expect(screen.getByLabelText("管理者ID")).toBeVisible();
    expect(screen.getByLabelText("パスワード")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.queryByText("アカウントを確認しています…")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/session",
      expect.objectContaining({
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
  });

  it("displays verified server metrics and paginates accounts without game auth", async () => {
    const fetchMock = vi.fn(async (path: string) => {
      if (path.includes("/session")) return response({ authenticated: false });
      if (path.includes("/login")) return response({ authenticated: true });
      if (path.includes("/overview")) return response(overview);
      if (path.includes("/accounts"))
        return response({
          total: 1,
          rows: [
            {
              id: "123",
              loginId: "demo01",
              email: "sample@example.com",
              coachName: "佐藤",
              schoolName: "桜台高校",
              regionId: "tokyo",
              createdAt: "2026-10-10T00:00:00.000Z",
              lastSignInAt: null,
              saveUpdatedAt: null,
              revision: 12,
              yearIndex: 1,
              matches: 3,
            },
          ],
        });
      throw new Error("unexpected route " + path);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminDashboard />);
    await screen.findByRole("heading", { name: "管理画面" });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "admintest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));
    expect(await screen.findByText("登録アカウント")).toBeVisible();
    expect(await screen.findByText("27")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "アカウント一覧" }));
    expect(await screen.findByText("demo01")).toBeVisible();
    fireEvent.change(
      screen.getByRole("textbox", { name: "アカウントを検索" }),
      { target: { value: "demo" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "検索" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("search=demo"),
        expect.anything(),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    expect(
      await screen.findByRole("heading", { name: "管理画面" }),
    ).toBeVisible();
  });
});
