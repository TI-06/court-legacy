import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createBrowserAppDependencies } from "../../../src/app/createBrowserAppDependencies";

describe("createBrowserAppDependencies E2E harness", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("does not import server-only scouting truth into the browser adapter", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/createBrowserAppDependencies.ts"),
      "utf8",
    );

    expect(source).not.toContain("worker/scouting/serverScoutingBoard");
    expect(source).not.toContain("worker/data/ScoutingStore");
  });

  it("persists authoritative game actions across bootstrap calls", async () => {
    const { api } = createBrowserAppDependencies({ MODE: "test" });

    const initial = await api.bootstrap("e2e-access-token");
    expect(initial.status).toBe("ready");
    if (initial.status !== "ready") return;
    expect(initial.game.revision).toBe(1);
    expect(
      initial.game.state.schools[initial.game.state.userSchoolId]!.funds,
    ).toBe(300);

    const response = await api.applyAction("e2e-access-token", {
      operationId: "op-facility-1",
      revision: initial.game.revision,
      action: { type: "facility-upgrade", facility: "trainingRoom" },
    });

    expect(response.game.revision).toBe(2);
    expect(
      response.game.state.schools[response.game.state.userSchoolId]!.funds,
    ).toBe(230);

    const reloaded = await api.bootstrap("e2e-access-token");
    expect(reloaded.status).toBe("ready");
    if (reloaded.status !== "ready") return;
    expect(reloaded.game.revision).toBe(2);
    expect(
      reloaded.game.state.schools[reloaded.game.state.userSchoolId]!.funds,
    ).toBe(230);
  });

  it("restores the E2E server snapshot when a new browser API client is created", async () => {
    const first = createBrowserAppDependencies({
      VITE_E2E_AUTH_BYPASS: "true",
    });
    const initial = await first.api.bootstrap("e2e-access-token");
    expect(initial.status).toBe("ready");
    if (initial.status !== "ready") return;

    await first.api.applyAction("e2e-access-token", {
      operationId: "op-reload-1",
      revision: initial.game.revision,
      action: { type: "facility-upgrade", facility: "trainingRoom" },
    });

    const second = createBrowserAppDependencies({
      VITE_E2E_AUTH_BYPASS: "true",
    });
    const reloaded = await second.api.bootstrap("e2e-access-token");
    expect(reloaded.status).toBe("ready");
    if (reloaded.status !== "ready") return;
    expect(reloaded.game.revision).toBe(2);
    expect(
      reloaded.game.state.schools[reloaded.game.state.userSchoolId]!.funds,
    ).toBe(230);
  });
});
