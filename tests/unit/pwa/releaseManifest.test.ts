import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

describe("Phase18 release manifest", () => {
  it("links an installable manifest from index.html", () => {
    const html = readFileSync(resolve(root, "index.html"), "utf8");

    expect(html).toContain('rel="manifest"');
    expect(html).toContain('href="/manifest.webmanifest"');
    expect(existsSync(resolve(root, "public/manifest.webmanifest"))).toBe(true);
  });

  it("declares standalone launch metadata and 192/512 icons", () => {
    const path = resolve(root, "public/manifest.webmanifest");

    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;

    const manifest = JSON.parse(readFileSync(path, "utf8")) as {
      name?: string;
      short_name?: string;
      start_url?: string;
      scope?: string;
      display?: string;
      theme_color?: string;
      background_color?: string;
      icons?: Array<{ src?: string; sizes?: string; purpose?: string }>;
    };

    expect(manifest.name).toBe("継承のコート");
    expect(manifest.short_name).toBe("継承のコート");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#132536");
    expect(manifest.background_color).toBe("#132536");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192" }),
        expect.objectContaining({ sizes: "512x512" }),
        expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
      ]),
    );
  });
});
