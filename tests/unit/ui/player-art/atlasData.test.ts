import allPartsAtlasUrl from "../../../../src/assets/player-parts/v1/all-parts-atlas";

describe("generated player WebP atlas", () => {
  it("contains the expected complete RIFF WebP payload", () => {
    expect(allPartsAtlasUrl.startsWith("data:image/webp;base64,")).toBe(true);

    const encoded = allPartsAtlasUrl.slice("data:image/webp;base64,".length);
    const bytes = Buffer.from(encoded, "base64");

    expect(encoded).toHaveLength(56_712);
    expect(bytes).toHaveLength(42_534);
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });
});
