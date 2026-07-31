import { readFileSync } from "node:fs";

function readUint24LittleEndian(bytes: Buffer, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

describe("generated player WebP atlas", () => {
  it("contains a valid 512 by 768 RIFF WebP payload", () => {
    const atlasPath = new URL(
      "../../../../src/assets/player-parts/v1/all-parts-atlas.webp",
      import.meta.url,
    );
    const bytes = readFileSync(atlasPath);

    expect(bytes.byteLength).toBeGreaterThan(1_000);
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(bytes.subarray(12, 16).toString("ascii")).toBe("VP8X");
    expect(readUint24LittleEndian(bytes, 24) + 1).toBe(512);
    expect(readUint24LittleEndian(bytes, 27) + 1).toBe(768);
  });
});
