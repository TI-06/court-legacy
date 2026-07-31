import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("generated player WebP atlas", () => {
  it("contains a valid 512 by 768 RIFF WebP payload", () => {
    const bytes = readFileSync(
      resolve(
        process.cwd(),
        "src/assets/player-parts/v1/all-parts-atlas.webp",
      ),
    );

    expect(bytes.byteLength).toBeGreaterThan(1_000);
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(bytes.subarray(12, 16).toString("ascii")).toBe("VP8X");
    expect(bytes.readUIntLE(24, 3) + 1).toBe(512);
    expect(bytes.readUIntLE(27, 3) + 1).toBe(768);
  });
});
