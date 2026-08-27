import { createBrowserAppDependencies } from "../../../src/app/createBrowserAppDependencies";

describe("createBrowserAppDependencies E2E harness", () => {
  it("persists authoritative game actions across bootstrap calls", async () => {
    const { api } = createBrowserAppDependencies({ MODE: "test" });

    const initial = await api.bootstrap("e2e-access-token");
    expect(initial.status).toBe("ready");
    if (initial.status !== "ready") return;
    expect(initial.game.revision).toBe(1);
    expect(initial.game.state.schools[initial.game.state.userSchoolId]!.funds).toBe(
      300,
    );

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
});
