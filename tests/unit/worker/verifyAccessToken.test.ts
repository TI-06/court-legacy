import { beforeEach, describe, expect, it, vi } from "vitest";

const joseMocks = vi.hoisted(() => ({
  createRemoteJWKSet: vi.fn((url: URL) => {
    void url;
    return "jwks-resolver";
  }),
  jwtVerify: vi.fn(),
}));

vi.mock("jose", () => joseMocks);

import { createVerifyAccessToken } from "../../../worker/auth/verifyAccessToken";

describe("createVerifyAccessToken", () => {
  beforeEach(() => {
    joseMocks.createRemoteJWKSet.mockClear();
    joseMocks.jwtVerify.mockReset();
  });

  it("verifies against the project JWKS with the authenticated audience", async () => {
    joseMocks.jwtVerify.mockResolvedValue({ payload: { sub: "user-123" } });
    const verify = createVerifyAccessToken({
      SUPABASE_URL: "https://project.supabase.co/",
    });

    await expect(verify("access-token")).resolves.toEqual({ id: "user-123" });

    expect(joseMocks.createRemoteJWKSet).toHaveBeenCalledTimes(1);
    expect(String(joseMocks.createRemoteJWKSet.mock.calls[0]?.[0])).toBe(
      "https://project.supabase.co/auth/v1/.well-known/jwks.json",
    );
    expect(joseMocks.jwtVerify).toHaveBeenCalledWith(
      "access-token",
      "jwks-resolver",
      {
        issuer: "https://project.supabase.co/auth/v1",
        audience: "authenticated",
      },
    );
  });

  it("rejects a verified token without a subject", async () => {
    joseMocks.jwtVerify.mockResolvedValue({ payload: {} });
    const verify = createVerifyAccessToken({
      SUPABASE_URL: "https://project.supabase.co",
    });

    await expect(verify("access-token")).rejects.toThrow("missing subject");
  });
});
