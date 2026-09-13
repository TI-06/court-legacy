import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

describe("Phase18 service worker cache boundary", () => {
  it("provides an explicit cache policy module and service worker", () => {
    expect(existsSync(resolve(root, "src/pwa/cachePolicy.ts"))).toBe(true);
    expect(existsSync(resolve(root, "public/sw.js"))).toBe(true);
  });
});
