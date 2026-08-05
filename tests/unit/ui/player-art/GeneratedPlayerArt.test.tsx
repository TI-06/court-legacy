import { act, render, screen, waitFor } from "@testing-library/react";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { resolveFeaturedCharacter } from "../../../../src/domain/appearance/characterWorld";
import {
  createPlayerArtRecipe,
  playerArtIdentitySignature,
} from "../../../../src/domain/appearance/playerArtRecipe";
import {
  loadAsset,
  resetAssetLoadCacheForTests,
} from "../../../../src/ui/player-art/assetLoadCache";
import { GeneratedPlayerArt } from "../../../../src/ui/player-art/GeneratedPlayerArt";
import { resolveGeneratedArtLayers } from "../../../../src/ui/player-art/generatedArtManifest";

interface FakeImageInstance {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
}

let createdImages: FakeImageInstance[] = [];

class FakeImage implements FakeImageInstance {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";

  constructor() {
    createdImages.push(this);
  }
}

function generatedPlayerFixture() {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const player = school.playerIds
    .map((playerId) => state.players[playerId])
    .find((candidate) => {
      return candidate && resolveFeaturedCharacter(candidate, school) === null;
    });

  if (!player) {
    throw new Error("a generated player fixture is required");
  }

  return { player, school };
}

function expectedAssetCount() {
  const { player, school } = generatedPlayerFixture();
  const layers = resolveGeneratedArtLayers(
    createPlayerArtRecipe(player, school),
  );
  return new Set(layers.map((layer) => layer.url)).size;
}

describe("GeneratedPlayerArt", () => {
  beforeEach(() => {
    createdImages = [];
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("CSS", { supports: vi.fn(() => true) });
    resetAssetLoadCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders independent layers only after every required asset loads", async () => {
    const { player, school } = generatedPlayerFixture();

    render(
      <GeneratedPlayerArt
        player={player}
        school={school}
        testId="generated-art"
        variant="card"
      />,
    );

    expect(screen.queryByTestId("generated-art")).not.toBeInTheDocument();
    expect(createdImages).toHaveLength(expectedAssetCount());

    await act(async () => {
      for (const image of createdImages) {
        image.onload?.();
      }
      await Promise.resolve();
    });

    expect(await screen.findByTestId("generated-art")).toBeVisible();
    const layers = screen.getAllByTestId("player-art-layer");
    expect(layers.length).toBeGreaterThanOrEqual(10);
    expect(layers.length).toBeLessThanOrEqual(12);
    expect(
      layers
        .map((layer) => layer.className)
        .some((value) => value.includes("player-art__layer--eyes")),
    ).toBe(true);
    expect(
      document.querySelector("svg[data-testid='player-character']"),
    ).toBeNull();
  });

  it("uses a roster-resolved recipe override without recomputing identity", async () => {
    const { player, school } = generatedPlayerFixture();
    const base = createPlayerArtRecipe(player, school);
    const frontHairStyle =
      base.frontHairStyle === "buzz" ? ("curly" as const) : ("buzz" as const);
    const recipeOverride = {
      ...base,
      variationSalt: base.variationSalt + 1,
      frontHairStyle,
      hairStyle: frontHairStyle,
    };

    render(
      <GeneratedPlayerArt
        player={player}
        recipeOverride={recipeOverride}
        school={school}
        testId="generated-art"
        variant="card"
      />,
    );

    await act(async () => {
      for (const image of createdImages) {
        image.onload?.();
      }
      await Promise.resolve();
    });

    expect(await screen.findByTestId("generated-art")).toHaveAttribute(
      "data-art-signature",
      playerArtIdentitySignature(recipeOverride),
    );
  });

  it("hides the character when any required asset fails", async () => {
    const { player, school } = generatedPlayerFixture();

    render(
      <GeneratedPlayerArt
        player={player}
        school={school}
        testId="generated-art"
        variant="full"
      />,
    );

    expect(createdImages).toHaveLength(expectedAssetCount());
    const failedUrl = createdImages[0]!.src;

    await act(async () => {
      createdImages[0]!.onerror?.();
      for (const image of createdImages.slice(1)) {
        image.onload?.();
      }
      await Promise.resolve();
    });

    await expect(loadAsset(failedUrl)).resolves.toBe("failed");
    await waitFor(() => {
      expect(screen.queryByTestId("generated-art")).not.toBeInTheDocument();
    });
    expect(screen.queryAllByTestId("player-art-layer")).toHaveLength(0);
    expect(
      document.querySelector("svg[data-testid='player-character']"),
    ).toBeNull();
  });

  it("does not request assets without raster mask support", () => {
    vi.stubGlobal("CSS", { supports: vi.fn(() => false) });
    const { player, school } = generatedPlayerFixture();

    render(
      <GeneratedPlayerArt
        player={player}
        school={school}
        testId="generated-art"
        variant="portrait"
      />,
    );

    expect(screen.queryByTestId("generated-art")).not.toBeInTheDocument();
    expect(createdImages).toHaveLength(0);
  });
});
