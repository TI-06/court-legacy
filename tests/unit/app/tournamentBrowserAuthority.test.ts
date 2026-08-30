import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("official tournament browser authority boundary", () => {
  it("does not import server-only guest materialization or result authority into browser dependency assembly", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/createBrowserAppDependencies.ts"),
      "utf8",
    );

    expect(source).not.toContain("materializeGuestOpponent");
    expect(source).not.toContain("resolveNpcTournamentMatch");
    expect(source).not.toContain("recordOfficialMatch");
    expect(source).not.toContain("worker/game/applyOfficialMatch");
  });
});
