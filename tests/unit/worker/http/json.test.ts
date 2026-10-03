import { describe, expect, it } from "vitest";
import { json, jsonError } from "../../../../worker/http/json";

describe("worker JSON responses", () => {
  it("exposes the deployed save protocol on successful responses", () => {
    const response = json({ ok: true });

    expect(response.headers.get("x-court-legacy-save-protocol")).toBe(
      "game-v5-shop-v2",
    );
  });

  it("exposes the same save protocol on error responses", () => {
    const response = jsonError(500, "server_error", "failed");

    expect(response.status).toBe(500);
    expect(response.headers.get("x-court-legacy-save-protocol")).toBe(
      "game-v5-shop-v2",
    );
  });
});
