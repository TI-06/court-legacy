import { act, render, screen } from "@testing-library/react";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { resolveFeaturedCharacter } from "../../../../src/domain/appearance/characterWorld";
import { createPlayerArtRecipe } from "../../../../src/domain/appearance/playerArtRecipe";
import { resetAssetLoadCacheForTests } from "../../../../src/ui/player-art/assetLoadCache";
import { resolveGeneratedArtLayers } from "../../../../src/ui/player-art/generatedArtManifest";
import { PlayerArt } from "../../../../src/ui/player-art/PlayerArt";

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

function fixtures() {
  const state = createDemoGame();
  const featured = Object.values(state.players).find((player) => {
    const school = state.schools[player.career.schoolId];
    return resolveFeaturedCharacter(player, school) !== null;
  });
  const normal = Object.values(state.players).find((player) => {
    const school = state.schools[player.career.schoolId];
    return resolveFeaturedCharacter(player, school) === null;
  });

  if (!featured || !normal) {
    throw new Error("featured and generated player fixtures are required");
  }

  return {
    featured,
    featuredSchool: state.schools[featured.career.schoolId]!,
    normal,
    normalSchool: state.schools[normal.career.schoolId]!,
  };
}

describe("PlayerArt", () => {
  beforeEach(() => {
    createdImages = [];
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("CSS", { supports: vi.fn(() => true) });
    resetAssetLoadCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses dedicated art for a featured player", () => {
    const { featured, featuredSchool } = fixtures();

    render(
      <PlayerArt player={featured} school={featuredSchool} variant="card" />,
    );

    expect(screen.getByTestId("featured-player-art")).toBeVisible();
    expect(
      screen.queryByTestId("generated-player-art"),
    ).not.toBeInTheDocument();
  });

  it("uses generated WebP layers for a normal player", async () => {
    const { normal, normalSchool } = fixtures();

    render(<PlayerArt player={normal} school={normalSchool} variant="card" />);

    expect(
      screen.queryByTestId("generated-player-art"),
    ).not.toBeInTheDocument();
    const expectedAssetCount = new Set(
      resolveGeneratedArtLayers(
        createPlayerArtRecipe(normal, normalSchool),
      ).map((layer) => layer.url),
    ).size;
    expect(createdImages).toHaveLength(expectedAssetCount);

    await act(async () => {
      for (const image of createdImages) {
        image.onload?.();
      }
      await Promise.resolve();
    });

    expect(await screen.findByTestId("generated-player-art")).toBeVisible();
    expect(screen.queryByTestId("featured-player-art")).not.toBeInTheDocument();
  });
});
