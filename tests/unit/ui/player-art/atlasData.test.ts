import {
  ATLAS_TILE,
  GENERATED_ART_CATALOG_VERSION,
  REQUIRED_GENERATED_ART_ATLASES,
} from "../../../../src/ui/player-art/generatedArtManifest";

describe("generated player modular atlas contract", () => {
  it("uses catalog v2 with fixed high-resolution transparent tiles", () => {
    expect(GENERATED_ART_CATALOG_VERSION).toBe(2);
    expect(ATLAS_TILE).toEqual({ width: 256, height: 384 });
  });

  it("requires every independent raster part atlas", () => {
    expect(REQUIRED_GENERATED_ART_ATLASES).toHaveLength(11);
    expect(
      REQUIRED_GENERATED_ART_ATLASES.every((url) => url.endsWith(".webp")),
    ).toBe(true);
    expect(new Set(REQUIRED_GENERATED_ART_ATLASES).size).toBe(11);
  });
});
