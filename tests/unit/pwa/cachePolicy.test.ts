import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classifyRequestForCache } from "../../../src/pwa/cachePolicy";

const applicationOrigin = "https://court-legacy.test";

function request(path: string, method = "GET", origin = applicationOrigin) {
  return { method, url: `${origin}${path}` };
}

describe("PWA cache policy", () => {
  it.each([
    ["/api/bootstrap", "GET"],
    ["/api/game/action", "POST"],
    ["/api/pvp/challenges", "POST"],
    ["/api/pvp/challenges/op-1", "GET"],
    ["/api/pvp/challenges/op-1/commands", "POST"],
    ["/api/shop/purchase", "POST"],
  ])("keeps %s %s network-authoritative", (path, method) => {
    expect(
      classifyRequestForCache(request(path, method), applicationOrigin),
    ).toBe("network-only");
  });

  it.each([
    "/assets/index-ABC123.js",
    "/assets/index-ABC123.css",
    "/icons/court-legacy-192.svg",
  ])("allows same-origin static GET asset %s to use the cache", (path) => {
    expect(classifyRequestForCache(request(path), applicationOrigin)).toBe(
      "static-cache",
    );
  });

  it("keeps cross-origin assets and navigations network-only", () => {
    expect(
      classifyRequestForCache(
        request("/assets/foreign.js", "GET", "https://cdn.example"),
        applicationOrigin,
      ),
    ).toBe("network-only");
    expect(classifyRequestForCache(request("/"), applicationOrigin)).toBe(
      "network-only",
    );
  });

  it("mirrors the network-authoritative boundary in the service worker", () => {
    const worker = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");

    expect(worker).toContain('request.method !== "GET"');
    expect(worker).toContain("url.origin !== self.location.origin");
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('url.pathname.startsWith("/assets/")');
    expect(worker).toContain('url.pathname.startsWith("/icons/")');
  });
});
